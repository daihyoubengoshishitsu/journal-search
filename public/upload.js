// upload.js - アップロードページJavaScript

const API_BASE_URL = 'http://localhost:3000'; // Node.jsサーバーのURL
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('csvFile');
const fileInfo = document.getElementById('fileInfo');
const progressContainer = document.getElementById('progressContainer');

// メッセージ表示関数
function showMessage(message, type = 'info') {
    const messageArea = document.getElementById('messageArea');
    messageArea.className = `message ${type}`;
    messageArea.textContent = message;
    messageArea.style.display = 'block';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            messageArea.style.display = 'none';
        }, 15000); // 成功/エラーメッセージは15秒表示
    }
}

// ファイル選択関数
function selectFile() {
    console.log('📂 ファイル選択ボタンがクリックされました');
    fileInput.click();
}

// 接続確認
async function testConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        const result = await response.json();
        
        if (response.ok) {
            showMessage(`✅ サーバー接続成功: ${result.message}`, 'success');
        } else {
            showMessage('❌ サーバー接続失敗', 'error');
        }
    } catch (error) {
        showMessage(`❌ 接続エラー: Node.jsサーバーが起動していない可能性があります`, 'error');
    }
}

// ドラッグ&ドロップ機能
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// アップロードエリアクリック時の動作を修正
uploadArea.addEventListener('click', (e) => {
    // ボタン以外の場所をクリックした場合のみファイル選択
    if (e.target === uploadArea || e.target.tagName === 'P' || e.target.tagName === 'H3') {
        selectFile();
    }
});

// ファイル変更イベントリスナー
fileInput.addEventListener('change', (e) => {
    console.log('📁 ファイルが選択されました:', e.target.files[0]);
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// ファイル処理関数（列名チェックを緩和）
function handleFile(file) {
    console.log('ファイル処理開始:', file);

    // ファイル形式チェック
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showMessage('❌ CSVファイルを選択してください。', 'error');
        return;
    }

    // ファイルサイズチェック（10MB制限）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showMessage('❌ ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。', 'error');
        return;
    }

    // ファイル情報表示
    document.getElementById('fileName').innerHTML = `<strong>📄 ファイル名:</strong> ${file.name}`;
    document.getElementById('fileSize').innerHTML = `<strong>📊 ファイルサイズ:</strong> ${(file.size / 1024).toFixed(2)} KB`;
    
    // ファイルプレビュー（列名チェックを緩和）
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').slice(0, 6); // 最初の6行を表示（ヘッダー+5行）
        
        // 列名チェックを削除（サーバー側で対応するため）
        let previewHtml = '<strong>📋 ファイルプレビュー:</strong><br>';
        previewHtml += `<pre style="font-size: 11px; background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 10px 0;">${lines.join('\n')}</pre>`;
        
        if (lines.length > 6) {
            previewHtml += `<small>... 他 ${text.split('\n').length - 6} 行</small>`;
        }
        
        document.getElementById('filePreview').innerHTML = previewHtml;
    };
    reader.readAsText(file, 'UTF-8');

    fileInfo.style.display = 'block';
    showMessage('✅ ファイルが選択されました。内容を確認してアップロードボタンをクリックしてください。', 'success');
}

// アップロード関数（エラーハンドリング改善）
async function uploadFile() {
    const file = fileInput.files[0];
    if (!file) {
        showMessage('❌ ファイルが選択されていません。', 'error');
        return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '🔄 アップロード中...';

    showProgress();
    updateProgress(5, 'ファイルを準備中...', 'サーバーに送信準備をしています');

    try {
        const formData = new FormData();
        formData.append('file', file);

        updateProgress(15, 'Node.jsサーバーに送信中...', 'ファイルをアップロードしています');

        console.log('🚀 アップロード開始:', file.name);

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });

        updateProgress(30, 'サーバーで処理開始...', 'CSVファイルを解析しています');

        // ポーリングで進行状況を更新
        const progressInterval = setInterval(() => {
            const currentProgress = parseInt(document.getElementById('progressFill').style.width) || 30;
            if (currentProgress < 85) {
                updateProgress(currentProgress + 5, 'Gemini AIでベクトル化処理中...', 'AI処理には時間がかかります');
            }
        }, 2000);

        const result = await response.json();
        clearInterval(progressInterval);

        updateProgress(95, 'データベースに保存中...', '最終処理を実行しています');

        await new Promise(resolve => setTimeout(resolve, 500)); // 少し待機

        updateProgress(100, '完了！', '処理が正常に完了しました');

        if (response.ok && result.status === 'success') {
            const data = result.data;
            const successMessage = `✅ アップロード完了！
📊 処理結果:
• 総件数: ${data.total_count}件
• 成功: ${data.success_count}件  
• 失敗: ${data.error_count}件
• 成功率: ${data.success_rate}%

🔍 検索ページで新しいデータを検索できます！`;
            
            showMessage(successMessage, 'success');
            
            // フォームをリセット
            setTimeout(() => {
                resetForm();
            }, 5000);
        } else {
            showMessage(`❌ アップロード失敗: ${result.message}`, 'error');
        }

    } catch (error) {
        console.error('アップロードエラー:', error);
        showMessage(`❌ アップロードエラー: ${error.message}`, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '🚀 アップロード開始';
        hideProgress();
    }
}

function showProgress() {
    progressContainer.style.display = 'block';
}

function hideProgress() {
    setTimeout(() => {
        progressContainer.style.display = 'none';
    }, 3000);
}

function updateProgress(percent, text, detail) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = text + ' (' + percent + '%)';
    if (detail) {
        document.getElementById('progressDetail').textContent = detail;
    }
}

function resetForm() {
    fileInput.value = '';
    fileInfo.style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    showMessage('🚀 修正版アップロードシステム準備完了！CSVファイルを選択してください。', 'success');
    
    // 自動的に接続確認
    setTimeout(() => {
        testConnection();
    }, 1000);
});

// ファイルドロップ時のページ遷移を防ぐ
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());