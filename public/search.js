// search.js - topics_processed対応完全版（微修正：表示位置変更・コピー機能削減）

const API_BASE_URL = 'http://localhost:3000';

// グローバル変数
let keywords = [];
let isSearching = false;

// DOM要素の取得
const elements = {};

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ 検索ページが読み込まれました（topics_processed対応版）');

    // DOM要素を取得
    elements.searchInput = document.getElementById('searchInput');
    elements.keywordTags = document.getElementById('keywordTags');
    elements.searchBtn = document.getElementById('searchBtn');
    elements.clearBtn = document.getElementById('clearBtn');
    elements.resultsSection = document.getElementById('resultsSection');
    elements.resultsContainer = document.getElementById('resultsContainer');
    elements.resultsCount = document.getElementById('resultsCount');
    elements.qualitySummary = document.getElementById('qualitySummary');
    elements.errorMessage = document.getElementById('errorMessage');
    elements.courtFilter = document.getElementById('courtFilter');
    elements.yearFilter = document.getElementById('yearFilter');
    elements.limitFilter = document.getElementById('limitFilter');

    // イベントリスナーの設定
    setupEventListeners();

    // 統計データを読み込み（自動）
    loadDatabaseStats();
});

// イベントリスナーの設定
function setupEventListeners() {
    // 検索入力でのキーボードイベント
    elements.searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();

            const currentValue = elements.searchInput.value.trim();

            if (currentValue) {
                addKeywordsFromInput(currentValue);
                console.log('✅ Enterキーでキーワード追加:', currentValue);
                // キーワード追加後、即座に検索実行
                setTimeout(() => {
                    performSearch();
                }, 100);
            } else {
                // 入力が空の場合は検索実行
                performSearch();
            }
        }
    });

    // 検索ボタンクリック
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', performSearch);
    }

    // クリアボタンクリック
    if (elements.clearBtn) {
        elements.clearBtn.addEventListener('click', clearSearchConditions);
    }
}

// 入力からキーワードを追加
function addKeywordsFromInput(input) {
    const inputKeywords = input.split(/[\s　,，]+/).filter(k => k.trim() !== '');
    inputKeywords.forEach(keyword => {
        if (!keywords.includes(keyword.trim())) {
            keywords.push(keyword.trim());
        }
    });
    
    updateKeywordTags();
    elements.searchInput.value = '';
}

// キーワードタグの更新
function updateKeywordTags() {
    if (!elements.keywordTags) return;
    
    if (keywords.length === 0) {
        elements.keywordTags.innerHTML = '<span class="no-keywords">キーワードを入力してEnterで追加</span>';
        return;
    }
    
    const tagsHTML = keywords.map((keyword, index) => {
        return `<span class="keyword-tag">
            ${keyword}
            <button onclick="removeKeyword(${index})" title="削除" class="remove-btn">✕</button>
        </span>`;
    }).join('');
    
    elements.keywordTags.innerHTML = tagsHTML;
}

// キーワード削除
function removeKeyword(index) {
    keywords.splice(index, 1);
    updateKeywordTags();
}

// 検索実行
async function performSearch() {
    if (keywords.length === 0) {
        showError('検索キーワードを入力してください。Enterキーでキーワードを追加できます。');
        elements.searchInput.focus();
        return;
    }

    console.log('🔍 topics_processed対応検索実行:', keywords);
    await executeSearch();
}

// 検索実行
async function executeSearch() {
    if (isSearching) {
        console.log('⚠️ 既に検索中です');
        return;
    }

    isSearching = true;

    const courtFilter = elements.courtFilter.value;
    const yearFilter = elements.yearFilter.value;
    const limit = parseInt(elements.limitFilter.value);

    elements.searchBtn.disabled = true;
    elements.searchBtn.textContent = '🔄 検索中...';
    elements.resultsSection.style.display = 'block';

    // 検索中は件数表示を隠す
    elements.resultsCount.textContent = '🔍 検索中...';
    elements.qualitySummary.innerHTML = '';

    elements.resultsContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>検索実行中...</p></div>';

    try {
        const searchParams = {
            keywords: keywords,
            court_filter: courtFilter,
            year_filter: yearFilter,
            limit: limit,
            similarity_threshold: 0.6
        };

        console.log('📡 送信パラメータ:', searchParams);

        const response = await fetch(API_BASE_URL + '/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchParams)
        });

        if (!response.ok) {
            throw new Error('HTTP エラー: ' + response.status + ' ' + response.statusText);
        }

        const data = await response.json();
        console.log('📡 サーバーレスポンス:', data);

        if (data.status === 'success') {
            displayResults(data.data);
        } else {
            throw new Error(data.message || '検索エラーが発生しました');
        }

    } catch (error) {
        console.error('❌ 検索エラー:', error);
        showError('検索エラー: ' + error.message);
        elements.resultsContainer.innerHTML = '<div class="no-results"><h4>🚨 検索エラーが発生しました</h4><p>' + error.message + '</p><p><small>サーバーとデータベースが正常に動作していることを確認してください</small></p><button onclick="performSearch()" style="margin-top: 15px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">🔄 再試行</button></div>';
        // エラー時は件数表示をリセット
        elements.resultsCount.textContent = '検索結果: エラー';
    } finally {
        isSearching = false;
        elements.searchBtn.disabled = false;
        elements.searchBtn.textContent = '🔍 topics_processed対応検索実行';
    }
}

// 検索結果表示
function displayResults(searchData) {
    const results = searchData.results || [];
    const total_count = searchData.total_count || 0;
    const search_stats = searchData.search_stats || {};
    const searchKeywords = searchData.keywords || [];

    console.log('📊 検索結果表示開始:', {
        results: results.length,
        total_count: total_count,
        search_stats: search_stats
    });

    // 検索完了後に正しい件数を表示
    elements.resultsCount.textContent = '検索結果: ' + total_count + '件 (表示: ' + results.length + '件)';

    const filterInfo = search_stats.filter_applied || {};
    const filterSummary = [];

    if (filterInfo.court_filter) {
        filterSummary.push('📍 地域: ' + filterInfo.court_filter);
    }
    if (filterInfo.year_filter) {
        const yearDisplay = filterInfo.year_display || filterInfo.year_filter;
        filterSummary.push('📅 年度: ' + yearDisplay);
    }

    const exactCount = search_stats.exact_match_count || 0;
    const synonymCount = search_stats.synonym_match_count || 0;
    const vectorCount = search_stats.vector_match_count || 0;

    let summaryHTML = '<div class="search-summary">';
    summaryHTML += '🎯 検索キーワード: <strong>「' + searchKeywords.join('」「') + '」</strong><br>';
    if (filterSummary.length > 0) {
        summaryHTML += '🔍 適用フィルター: ' + filterSummary.join(', ') + '<br>';
    }
    summaryHTML += '🎯 完全一致: <strong>' + exactCount + '件</strong> | ';
    summaryHTML += '🔄 類義語一致: <strong>' + synonymCount + '件</strong> | ';
    summaryHTML += '🤖 AIベクトル類似: <strong>' + vectorCount + '件</strong><br>';
    if (search_stats.avg_similarity) {
        summaryHTML += '📈 平均類似度: <strong>' + (search_stats.avg_similarity * 100).toFixed(1) + '%</strong>';
    }
    summaryHTML += '</div>';

    elements.qualitySummary.innerHTML = summaryHTML;

    if (results.length === 0) {
        elements.resultsContainer.innerHTML = '<div class="no-results"><h4>🔍 該当する判例が見つかりませんでした</h4><p>検索条件を変更してもう一度お試しください。</p></div>';
        return;
    }

    let resultsHTML = '';
    
    results.forEach(function(result, index) {
        const matchTypeClass = (result.match_type && result.match_type.replace('_', '-')) || 'default';
        const matchTypeLabel = getMatchTypeLabel(result.match_type);
        const confidenceColor = getConfidenceColor(result.confidence);

        const hanketsuDateDisplay = result.hanketsu_date || '日付不明';
        const displayYear = result.display_year || '';

        const originalTopics = result.topics || '';
        const processedTopics = result.topics_processed || '';
        const hasProcessedTopics = processedTopics && processedTopics.trim() !== '' && processedTopics !== 'null';

        // コピー用テキストの準備（加工済みのみ）
        const copyTextProcessed = hasProcessedTopics ? escapeForCopy(processedTopics) : '';

        let itemHTML = '<div class="result-item ' + matchTypeClass + '">';
        
        // ヘッダー部分（マッチタイプバッジを削除）
        itemHTML += '<div class="result-header">';
        itemHTML += '<div class="result-info">';
        itemHTML += '<h3>📄 ' + result.go + '号 第' + result.bango + '番</h3>';
        itemHTML += '</div>';
        
        itemHTML += '<div class="result-meta">';
        itemHTML += '<div class="court-info">🏛️ ' + (result.saibansho || '裁判所不明') + '</div>';
        itemHTML += '<div class="date-info">📅 ' + hanketsuDateDisplay;
        if (displayYear) {
            itemHTML += ' (' + displayYear + ')';
        }
        itemHTML += '</div>';
        itemHTML += '</div>';
        itemHTML += '</div>';

        // トピックス表示セクション
        itemHTML += '<div class="result-content">';
        itemHTML += '<div class="topics-container">';

        // 元のトピックス表示
        itemHTML += '<div class="topics-original">';
        itemHTML += '<div class="topics-text">' + highlightKeywords(originalTopics, searchKeywords, result.matched_keywords) + '</div>';
        itemHTML += '</div>';

        // 加工済みトピックス表示
        if (hasProcessedTopics) {
            itemHTML += '<div class="topics-processed">';
            itemHTML += '<div class="topics-text">' + highlightKeywords(processedTopics, searchKeywords, result.matched_keywords) + '</div>';
            itemHTML += '</div>';
        } else {
            itemHTML += '<div class="topics-processed empty">';
            itemHTML += '<div class="topics-text">加工済みデータが登録されていません</div>';
            itemHTML += '</div>';
        }

        itemHTML += '</div>'; // topics-container終了

        // コピーボタンセクション（加工済みのみ）
        itemHTML += '<div class="copy-buttons">';
        if (hasProcessedTopics) {
            itemHTML += '<button class="copy-btn-processed" onclick="copyToClipboardNew(\'' + copyTextProcessed + '\', this, \'processed\')">✨ コピー</button>';
        }
        itemHTML += '</div>';

        // マッチキーワード情報表示（右端にマッチタイプバッジを移動）
        if (result.matched_keywords && result.matched_keywords.length > 0) {
            itemHTML += '<div class="matched-keywords" style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;"><div><strong>🎯 トピックス内一致キーワード:</strong> ';
            result.matched_keywords.forEach(function(kw, idx) {
                if (idx > 0) itemHTML += ', ';
                itemHTML += '<span class="keyword-highlight">' + kw + '</span>';
            });
            itemHTML += '</div>';
            
            // マッチタイプバッジを右端に表示（マーク・枠・色なし）
            itemHTML += '<div class="match-type-badges">';
            itemHTML += '<span class="match-type-badge ' + matchTypeClass + '">' + getSimpleMatchTypeLabel(result.match_type) + '</span>';
            if (result.confidence) {
                itemHTML += '<span class="confidence-badge" style="margin-left: 8px;">' + result.confidence + '%</span>';
            }
            itemHTML += '</div>';
            itemHTML += '</div>';
        } else {
            // マッチキーワードがない場合でもバッジを表示（マーク・枠・色なし）
            itemHTML += '<div class="matched-keywords" style="margin-top: 15px; display: flex; justify-content: flex-end; align-items: center;">';
            itemHTML += '<div class="match-type-badges">';
            itemHTML += '<span class="match-type-badge ' + matchTypeClass + '">' + getSimpleMatchTypeLabel(result.match_type) + '</span>';
            if (result.confidence) {
                itemHTML += '<span class="confidence-badge" style="margin-left: 8px;">' + result.confidence + '%</span>';
            }
            itemHTML += '</div>';
            itemHTML += '</div>';
        }

        if (result.synonyms_used && result.synonyms_used.length > 0) {
            itemHTML += '<div class="synonyms-used"><strong>🔄 使用された類義語:</strong> ';
            result.synonyms_used.forEach(function(syn, idx) {
                if (idx > 0) itemHTML += ', ';
                itemHTML += '<span class="synonym-highlight">' + syn + '</span>';
            });
            itemHTML += '</div>';
        }

        if (result.match_type === 'vector_match') {
            itemHTML += '<div class="vector-match-info"><strong>🤖 AIベクトル検索:</strong> <span class="vector-highlight">文脈類似度 ' + result.confidence + '%</span></div>';
        }

        itemHTML += '</div>'; // result-content終了
        itemHTML += '</div>'; // result-item終了

        resultsHTML += itemHTML;
    });

    elements.resultsContainer.innerHTML = resultsHTML;
}

// エスケープ処理関数
function escapeForCopy(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// 新しいコピー機能（加工済みのみ）
function copyToClipboardNew(text, buttonElement, type) {
    try {
        // エスケープ文字をデコード
        const decodedText = text.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
        
        navigator.clipboard.writeText(decodedText).then(function() {
            const originalText = buttonElement.textContent;
            
            let successText = '✅ コピー完了';
            if (type === 'processed') {
                successText = '✅ 加工済みコピー完了';
            }
            
            buttonElement.textContent = successText;
            buttonElement.classList.add('copied');
            
            setTimeout(function() {
                buttonElement.textContent = originalText;
                buttonElement.classList.remove('copied');
            }, 2000);
        });
        
    } catch (error) {
        console.error('コピーエラー:', error);
        showError('コピーに失敗しました');
    }
}

// マッチタイプのラベル取得（マークなし・シンプル版）
function getSimpleMatchTypeLabel(matchType) {
    const labels = {
        'exact_match': '完全一致',
        'synonym_match': '類義語一致',
        'vector_match': 'AIベクトル類似'
    };
    return labels[matchType] || '検索結果';
}

// マッチタイプのラベル取得
function getMatchTypeLabel(matchType) {
    const labels = {
        'exact_match': '🎯 完全一致',
        'synonym_match': '🔄 類義語一致',
        'vector_match': '🤖 AIベクトル類似'
    };
    return labels[matchType] || '🔍 検索結果';
}

// 信頼度による色分け
function getConfidenceColor(confidence) {
    if (confidence >= 90) return '#4CAF50';
    if (confidence >= 80) return '#FF9800';
    if (confidence >= 70) return '#2196F3';
    if (confidence >= 60) return '#9C27B0';
    return '#757575';
}

// キーワードハイライト
function highlightKeywords(text, originalKeywords, matchedKeywords) {
    let highlightedText = text || '';

    if (matchedKeywords && matchedKeywords.length > 0) {
        matchedKeywords.forEach(function(keyword) {
            const keywordMatch = keyword.match(/^(.+?)\((.+?)\)$/);
            let keywordToHighlight, classToUse;
            
            if (keywordMatch) {
                keywordToHighlight = keywordMatch[1];
                classToUse = 'synonym-highlight';
            } else {
                keywordToHighlight = keyword;
                classToUse = 'keyword-highlight';
            }
            
            const regex = new RegExp('(' + escapeRegExp(keywordToHighlight) + ')', 'gi');
            highlightedText = highlightedText.replace(regex, '<span class="' + classToUse + '">$1</span>');
        });
    } else if (originalKeywords && originalKeywords.length > 0) {
        originalKeywords.forEach(function(keyword) {
            const regex = new RegExp('(' + escapeRegExp(keyword) + ')', 'gi');
            highlightedText = highlightedText.replace(regex, '<span class="keyword-highlight">$1</span>');
        });
    }

    return highlightedText;
}

// 正規表現エスケープ
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 統計情報を読み込み
async function loadDatabaseStats() {
    try {
        console.log('📊 統計データ取得開始');

        const response = await fetch(API_BASE_URL + '/api/stats');
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
                const totalCount = data.data.total_count || 0;
                const totalRecordsElement = document.getElementById('totalRecords');
                if (totalRecordsElement) {
                    totalRecordsElement.textContent = totalCount.toLocaleString() + '件';
                }
                console.log('✅ 統計データ取得完了: ' + totalCount + '件');
            } else {
                const totalRecordsElement = document.getElementById('totalRecords');
                if (totalRecordsElement) {
                    totalRecordsElement.textContent = '0件';
                }
                console.log('⚠️ 統計データが空です');
            }
        } else {
            const totalRecordsElement = document.getElementById('totalRecords');
            if (totalRecordsElement) {
                totalRecordsElement.textContent = 'エラー';
            }
            console.error('❌ 統計データ取得失敗:', response.status);
        }
    } catch (error) {
        console.error('❌ 統計データ取得エラー:', error);
        const totalRecordsElement = document.getElementById('totalRecords');
        if (totalRecordsElement) {
            totalRecordsElement.textContent = 'エラー';
        }
    }
}

// 検索条件クリア
function clearSearchConditions() {
    console.log('🗑️ 検索条件をクリアします');

    keywords = [];
    updateKeywordTags();
    elements.searchInput.value = '';

    elements.courtFilter.value = '';
    elements.yearFilter.value = '';
    elements.limitFilter.value = '20';

    elements.resultsSection.style.display = 'none';
    elements.searchInput.focus();
}

// エラー表示
function showError(message) {
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
        elements.errorMessage.className = 'message error';
        elements.errorMessage.style.display = 'block';
        
        setTimeout(function() {
            elements.errorMessage.style.display = 'none';
        }, 10000);
    }
}

// メッセージ表示
function showMessage(message, type) {
    type = type || 'info';
    const messageEl = elements.errorMessage;
    messageEl.textContent = message;
    messageEl.className = 'message ' + type;
    messageEl.style.display = 'block';

    const timeout = type === 'success' ? 5000 : 10000;
    setTimeout(function() {
        messageEl.style.display = 'none';
    }, timeout);
}