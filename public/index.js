// index.js - ホームページJavaScript

// アップロードページへ遷移
function goToUpload() {
    console.log('📁 アップロードページに移動');
    window.location.href = 'upload.html';
}

// 検索ページへ遷移
function goToSearch() {
    console.log('🔍 検索ページに移動');
    window.location.href = 'search.html';
}

// ページ読み込み完了
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 自保ジャーナル検索システム - シンプル版 初期化完了');
});

// キーボードショートカット（オプション）
document.addEventListener('keydown', function(e) {
    if (e.key === '1' || e.key === 'u') {
        goToUpload();
    } else if (e.key === '2' || e.key === 's') {
        goToSearch();
    }
});