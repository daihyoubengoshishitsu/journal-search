const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

// 設定
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';

// Gemini AI設定
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 類義語辞書の定義
const SYNONYM_DICTIONARY = {
    '衝突': ['追突', 'ぶつかる', 'ぶつかり', '激突', '接触', '衝撃'],
    '追突': ['衝突', 'ぶつかる', '後方衝突', 'rear-end'],
    '接触': ['衝突', '追突', 'ぶつかる', '軽微な衝突'],
    '赤信号': ['赤', '停止信号', '赤色信号', '赤信号機'],
    '青信号': ['青', '進行信号', '青色信号', '青信号機', '緑信号'],
    '黄信号': ['黄', '注意信号', '黄色信号', '黄信号機'],
    '医療過誤': ['医療ミス', '医療事故', '医療間違い', '診療過誤', 'メディカルエラー'],
    '医療ミス': ['医療過誤', '医療事故', '医療間違い', '診療過誤'],
    '医療事故': ['医療過誤', '医療ミス', '医療間違い', '診療過誤'],
    '損害賠償': ['損害補償', '賠償', '補償', '慰謝料'],
    '慰謝料': ['損害賠償', '精神的損害', '慰謝金'],
    '後遺障害': ['後遺症', '永続的障害', '残存障害'],
    '後遺症': ['後遺障害', '永続的障害', '残存障害'],
    '自動車': ['車', '車両', '乗用車', '普通車'],
    '車両': ['自動車', '車', '乗用車'],
    'バイク': ['二輪車', 'オートバイ', '自動二輪車', '単車'],
    '自転車': ['チャリ', 'サイクル'],
    '保険金': ['保険料', '給付金', '保険給付'],
    '自賠責': ['自賠責保険', '強制保険'],
    '任意保険': ['任意保険'],
    '裁判': ['訴訟', '法廷', '審理'],
    '判決': ['判断', '裁定', '決定'],
    '棄却': ['却下', '不受理', '否認'],
    '認容': ['受理', '容認', '認定'],
    '過失': ['negligence', '注意義務違反', '不注意'],
    '重過失': ['重大な過失', '故意に近い過失'],
    '否認': ['否定', '却下', '棄却', '認めず', '認められず'],
    '認定': ['認める', '容認', '認容', '判断'],
    '頭痛': ['頭の痛み', 'ヘッドエイク'],
    '首の痛み': ['頸部痛', '首痛', 'ネックペイン'],
    '腰痛': ['腰の痛み', 'バックペイン'],
    '低髄液圧症候群': ['脳脊髄液減少症', 'CSF漏出症候群', '髄液漏れ']
};

// Supabase設定
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// クライアント初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ミドルウェア設定
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ベクトル化関数
async function createEmbedding(text) {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error('ベクトル化エラー:', error);
        return null;
    }
}

// 和暦を西暦に変換する関数
function convertWarekiToSeireki(dateString) {
    const eraPatterns = [
        { era: '令和', startYear: 2019, regex: /令和\s*(\d+)\s*年/ },
        { era: '平成', startYear: 1989, regex: /平成\s*(\d+)\s*年/ },
        { era: '昭和', startYear: 1926, regex: /昭和\s*(\d+)\s*年/ }
    ];

    for (const { startYear, regex } of eraPatterns) {
        const match = dateString.match(regex);
        if (match) {
            const year = startYear + parseInt(match[1], 10) - 1;
            return year;
        }
    }

    return null;
}

function formatYearDisplay(year) {
    const y = parseInt(year);
    if (isNaN(y)) return year;

    if (y >= 2019) {
        const reiwaYear = y - 2018;
        return `${y}年（令和${reiwaYear}年）`;
    } else if (y >= 1989) {
        const heiseiYear = y - 1988;
        return `${y}年（平成${heiseiYear}年）`;
    } else if (y >= 1926) {
        const showaYear = y - 1925;
        return `${y}年（昭和${showaYear}年）`;
    }

    return `${y}年`;
}

// 類義語展開関数
function expandKeywordsWithSynonyms(keywords) {
    const expandedKeywords = new Set();

    keywords.forEach(keyword => {
        const normalizedKeyword = keyword.trim();
        expandedKeywords.add(normalizedKeyword);

        if (SYNONYM_DICTIONARY[normalizedKeyword]) {
            SYNONYM_DICTIONARY[normalizedKeyword].forEach(synonym => expandedKeywords.add(synonym));
        }

        for (const [mainWord, synonyms] of Object.entries(SYNONYM_DICTIONARY)) {
            if (synonyms.includes(normalizedKeyword)) {
                expandedKeywords.add(mainWord);
            }
        }
    });

    return Array.from(expandedKeywords);
}

// ベクトル類似度計算
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 🆕 ベクトル検索強化版AND検索機能（topics_processed対応）
async function performEnhancedVectorANDSearch(keywords, options = {}) {
    const {
        limit = 20,
        court_filter = '',
        year_filter = '',
        similarity_threshold = 0.6
    } = options;

    try {
        console.log('🔍 ベクトル検索強化版AND検索開始:', keywords);

        // キーワードを結合してクエリベクトルを作成
        const queryText = keywords.join(' ');
        const queryEmbedding = await createEmbedding(queryText);

        if (!queryEmbedding) {
            throw new Error('クエリのベクトル化に失敗しました');
        }

        const expandedKeywords = expandKeywordsWithSynonyms(keywords);

        // 🆕 データベースから候補を取得（topics_processedも含める）
        let query = supabase
            .from('jiho_cases')
            .select('id, go, bango, topics, topics_processed, saibansho, hanketsu_date, embedding');

        if (court_filter) {
            query = query.ilike('saibansho', `%${court_filter}%`);
        }

        if (year_filter) {
            let yearPattern;
            const year = parseInt(year_filter);
            
            if (year >= 2019) {
                // 令和年度の処理
                const reiwaYear = year - 2018;
                yearPattern = `令和${reiwaYear}年`;
            } else if (year >= 1989) {
                // 平成年度の処理
                const heiseiYear = year - 1988;
                yearPattern = `平成${heiseiYear}年`;
            } else if (year >= 1926) {
                // 昭和年度の処理
                const showaYear = year - 1925;
                yearPattern = `昭和${showaYear}年`;
            } else {
                // 西暦のみの場合
                yearPattern = `${year}年`;
            }
            
            query = query.ilike('hanketsu_date', `%${yearPattern}%`);
            console.log(`📅 ベクトル検索での年度フィルター適用: ${year_filter} → ${yearPattern}`);
        }

        query = query.limit(2000); // より多くの候補を取得してベクトル検索

        const { data: allData, error } = await query;
        if (error) throw error;

        console.log(`📊 データベースから取得: ${allData.length}件`);

        const exactMatches = [];
        const synonymMatches = [];
        const vectorMatches = [];

        // 段階1: 完全一致検索（元のtopicsと加工済みtopics_processedの両方で検索）
        for (const item of allData) {
            const topicsText = (item.topics || '').toLowerCase();
            const topicsProcessedText = (item.topics_processed || '').toLowerCase();
            
            let allKeywordsFound = true;
            const matchedKeywords = [];
            const matchSources = []; // どちらのテキストでマッチしたかを記録

            for (const keyword of keywords) {
                const lowerKeyword = keyword.toLowerCase();
                let keywordFound = false;
                
                // 元のtopicsでチェック
                if (topicsText.includes(lowerKeyword)) {
                    matchedKeywords.push(keyword);
                    matchSources.push('original');
                    keywordFound = true;
                }
                // 加工済みtopics_processedでチェック
                else if (topicsProcessedText.includes(lowerKeyword)) {
                    matchedKeywords.push(keyword);
                    matchSources.push('processed');
                    keywordFound = true;
                }

                if (!keywordFound) {
                    allKeywordsFound = false;
                    break;
                }
            }

            if (allKeywordsFound) {
                exactMatches.push({
                    ...item,
                    similarity: 1.0,
                    confidence: 100,
                    matched_keywords: matchedKeywords,
                    match_sources: matchSources, // 🆕 マッチソース情報を追加
                    match_type: 'exact_match',
                    hanketsu_date: item.hanketsu_date,
                    display_year: formatYearDisplay(convertWarekiToSeireki(item.hanketsu_date))
                });
            }
        }

        console.log(`🎯 完全一致: ${exactMatches.length}件`);

        // 段階2: 類義語一致検索（完全一致以外）
        for (const item of allData) {
            if (exactMatches.some(exact => exact.id === item.id)) {
                continue;
            }

            const topicsText = (item.topics || '').toLowerCase();
            const topicsProcessedText = (item.topics_processed || '').toLowerCase();
            
            let allKeywordsFoundWithSynonyms = true;
            const matchedKeywords = [];
            const synonymsUsed = [];
            const matchSources = [];

            for (const keyword of keywords) {
                let keywordFound = false;

                // 元のキーワードチェック（元テキスト）
                if (topicsText.includes(keyword.toLowerCase())) {
                    matchedKeywords.push(keyword);
                    matchSources.push('original');
                    keywordFound = true;
                }
                // 元のキーワードチェック（加工済みテキスト）
                else if (topicsProcessedText.includes(keyword.toLowerCase())) {
                    matchedKeywords.push(keyword);
                    matchSources.push('processed');
                    keywordFound = true;
                } else {
                    // 類義語チェック
                    const synonyms = SYNONYM_DICTIONARY[keyword] || [];
                    for (const synonym of synonyms) {
                        if (topicsText.includes(synonym.toLowerCase())) {
                            matchedKeywords.push(`${keyword}(${synonym})`);
                            synonymsUsed.push(synonym);
                            matchSources.push('original');
                            keywordFound = true;
                            break;
                        } else if (topicsProcessedText.includes(synonym.toLowerCase())) {
                            matchedKeywords.push(`${keyword}(${synonym})`);
                            synonymsUsed.push(synonym);
                            matchSources.push('processed');
                            keywordFound = true;
                            break;
                        }
                    }
                }

                if (!keywordFound) {
                    allKeywordsFoundWithSynonyms = false;
                    break;
                }
            }

            if (allKeywordsFoundWithSynonyms) {
                synonymMatches.push({
                    ...item,
                    similarity: 0.9,
                    confidence: 90,
                    matched_keywords: matchedKeywords,
                    synonyms_used: synonymsUsed,
                    match_sources: matchSources,
                    match_type: 'synonym_match',
                    hanketsu_date: item.hanketsu_date,
                    display_year: formatYearDisplay(convertWarekiToSeireki(item.hanketsu_date))
                });
            }
        }

        console.log(`🔄 類義語一致: ${synonymMatches.length}件`);

        // 段階3: ベクトル類似度検索（完全一致・類義語一致以外）
        const processedIds = new Set([
            ...exactMatches.map(m => m.id),
            ...synonymMatches.map(m => m.id)
        ]);

        for (const item of allData) {
            if (processedIds.has(item.id)) {
                continue;
            }

            if (item.embedding && Array.isArray(item.embedding)) {
                const similarity = cosineSimilarity(queryEmbedding, item.embedding);
                
                if (similarity >= similarity_threshold) {
                    const confidence = Math.round(similarity * 100);
                    
                    vectorMatches.push({
                        ...item,
                        similarity: similarity,
                        confidence: confidence,
                        matched_keywords: keywords, // ベクトル検索では元のキーワードを表示
                        match_type: 'vector_match',
                        hanketsu_date: item.hanketsu_date,
                        display_year: formatYearDisplay(convertWarekiToSeireki(item.hanketsu_date))
                    });
                }
            }
        }

        // ベクトル検索結果を類似度順にソート
        vectorMatches.sort((a, b) => b.similarity - a.similarity);

        console.log(`🤖 ベクトル類似: ${vectorMatches.length}件（閾値: ${similarity_threshold}）`);

        // 結果をマージ
        const allResults = [
            ...exactMatches,
            ...synonymMatches,
            ...vectorMatches
        ];

        const stats = {
            total_candidates: allData.length,
            exact_match_count: exactMatches.length,
            synonym_match_count: synonymMatches.length,
            vector_match_count: vectorMatches.length,
            avg_similarity: allResults.length > 0 
                ? allResults.reduce((sum, item) => sum + item.similarity, 0) / allResults.length 
                : 0,
            keywords_searched: keywords,
            expanded_keywords: expandedKeywords,
            search_type: 'enhanced_vector_and_search',
            similarity_threshold: similarity_threshold,
            filter_applied: {
                court_filter: court_filter,
                year_filter: year_filter,
                year_converted: year_filter ? convertWarekiToSeireki(year_filter) : null,
                year_display: year_filter ? formatYearDisplay(year_filter) : null
            }
        };

        console.log('📊 検索統計:', stats);

        return {
            results: allResults.slice(0, limit),
            total_count: allResults.length,
            search_stats: stats,
            query_text: queryText,
            keywords: keywords,
            expanded_keywords: expandedKeywords
        };

    } catch (error) {
        console.error('❌ ベクトル検索強化版AND検索エラー:', error);
        throw error;
    }
}

// 検索API
app.post('/api/search', async (req, res) => {
    try {
        console.log('🔍 検索API呼び出し:', req.body);

        const { keywords, court_filter, year_filter, limit, similarity_threshold } = req.body;
        
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'キーワードが指定されていません'
            });
        }

        const options = {
            court_filter: court_filter || '',
            year_filter: year_filter || '',
            limit: limit || 20,
            similarity_threshold: similarity_threshold || 0.6
        };

        const results = await performEnhancedVectorANDSearch(keywords, options);

        res.json({
            status: 'success',
            data: results
        });
    } catch (error) {
        console.error('❌ 検索APIエラー:', error);
        res.status(500).json({
            status: 'error',
            message: '検索処理に失敗しました: ' + error.message
        });
    }
});

// ホームページ
app.get('/', (req, res) => {
    res.json({
        message: '自保ジャーナル検索システム（topics_processed対応版）が起動しました!',
        status: 'running',
        host: HOST,
        port: PORT,
        version: '13.0-topics-processed-support',
        features: [
            '段階的検索（完全一致→類義語一致→AIベクトル類似）',
            'Gemini AI ベクトル検索対応',
            '拡張類義語辞書対応',
            '地域別プルダウンフィルター',
            '年度プルダウンフィルター（和暦・西暦対応）',
            '高精度類似度スコア',
            '判決年月日フル表示',
            '🆕 元のトピックス＆加工済みトピックス両方表示',
            '🆕 個別コピー機能（元・加工済み・両方）'
        ],
        synonym_dictionary_size: Object.keys(SYNONYM_DICTIONARY).length,
        ai_features: [
            'text-embedding-004',
            'cosine_similarity',
            'vector_search_threshold_0.6',
            'topics_processed_support'
        ]
    });
});

// 統計情報API
app.get('/api/stats', async (req, res) => {
    try {
        const { data, error, count } = await supabase
            .from('jiho_cases')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        res.json({
            status: 'success',
            data: {
                total_count: count || 0,
                last_updated: new Date().toISOString(),
                synonym_dictionary_size: Object.keys(SYNONYM_DICTIONARY).length,
                search_features: [
                    'exact_match',
                    'synonym_match',
                    'vector_match_with_gemini_ai',
                    'region_dropdown_filter',
                    'year_dropdown_filter_with_wareki',
                    'full_date_display',
                    'cosine_similarity_search',
                    'topics_processed_support'
                ],
                ai_model: 'text-embedding-004',
                vector_search_threshold: 0.6
            }
        });

    } catch (error) {
        console.error('❌ 統計情報取得エラー:', error);
        res.status(500).json({
            status: 'error',
            message: '統計情報の取得に失敗しました'
        });
    }
});

// サーバー起動
app.listen(PORT, HOST, () => {
    console.log(`🚀 topics_processed対応版サーバーが起動しました: http://${HOST}:${PORT}`);
    console.log(`📚 類義語辞書: ${Object.keys(SYNONYM_DICTIONARY).length}エントリ`);
    console.log(`🤖 AI検索: Gemini text-embedding-004 対応`);
    console.log(`🔍 検索方式: 段階的検索（完全一致→類義語→ベクトル類似）`);
    console.log(`✨ 新機能: 元のトピックス＆加工済みトピックス両方表示対応`);
});