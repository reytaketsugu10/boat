window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

console.log("✅ upload.js 読み込み完了");

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let selectedFiles = [];

const dropArea = document.getElementById('drop-area');
const fileElem = document.getElementById('fileElem');
const uploadBtn = document.getElementById('uploadBtn');

// ドラッグ＆ドロップ処理
['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.add('highlight');
  }, false);
});
['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.remove('highlight');
  }, false);
});
dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  selectedFiles = files.filter(file => file.type === "application/pdf");

  if (selectedFiles.length === 0) {
    alert("PDFファイルをドロップしてください");
    return;
  }

  console.log("ドロップされたファイル:", selectedFiles.map(f => f.name));
  uploadBtn.disabled = false;
});
fileElem.addEventListener('change', (e) => {
  selectedFiles = Array.from(e.target.files).filter(file => file.type === "application/pdf");

  if (selectedFiles.length === 0) {
    alert("PDFファイルを選択してください");
    return;
  }

  console.log("選択されたファイル:", selectedFiles.map(f => f.name));
  uploadBtn.disabled = false;
});

// Google API 初期化
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}
function gisLoaded() {
  console.log("✅ gisLoaded が呼び出されました");
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: () => {}
    });
    gisInited = true;
    maybeEnableUpload();
  } catch (e) {
    console.error("❌ tokenClient の初期化に失敗", e);
  }
}
async function initializeGapiClient() {
  try {
    await gapi.client.init({
      apiKey: apiKey,
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        'https://sheets.googleapis.com/$discovery/rest?version=v4',
      ],
    });
    gapiInited = true;
    maybeEnableUpload();
  } catch (e) {
    console.error("❌ GAPI 初期化失敗", e);
  }
}

function maybeEnableUpload() {
  if (gapiInited && gisInited) {
    uploadBtn.disabled = false;
    console.log("✅ Google API準備完了。アップロード可能");
  }
}

// ファイル名からタイトル抽出
function extractTitleFromFilename(filename) {
  for (const title in folderMap) {
    if (filename.includes(title)) {
      return title;
    }
  }
  return null;
}

// アップロード処理
uploadBtn.addEventListener('click', async () => {
  console.log("✅ アップロードボタンがクリックされました");

  if (!gapiInited || !gisInited) {
    alert("Google APIの初期化が完了していません。しばらくしてから再試行してください。");
    return;
  }

  if (!tokenClient) {
    console.warn("⚠️ tokenClient が未定義。再初期化を試みます");
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: () => {}
      });
      gisInited = true;
      maybeEnableUpload();
    } catch (e) {
      alert("認証クライアントの初期化に失敗しました。APIキーやクライアントIDを確認してください。");
      return;
    }
  }

  if (!selectedFiles.length) {
    alert("ファイルを選択またはドロップしてください");
    return;
  }

  tokenClient.callback = async (resp) => {
    if (resp.error) {
      console.error("❌ 認証エラー:", resp);
      alert("認証に失敗しました。再度お試しください。");
      return;
    }

    for (const file of selectedFiles) {
      const title = extractTitleFromFilename(file.name);
      if (!title || !folderMap[title]) {
        alert(`対応する地名が見つかりません: ${file.name}`);
        continue;
      }

      const metadata = {
        name: file.name,
        parents: [folderMap[title]],
        mimeType: 'application/pdf'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ Authorization: `Bearer ${gapi.auth.getToken().access_token}` }),
        body: form,
      });

      const uploadedFile = await uploadRes.json();
      const now = new Date().toISOString();

      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: 'A:D',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [[title, file.name, uploadedFile.id, now]]
        }
      });

      console.log(`✅ アップロード成功: ${file.name}`);
    }

    alert("すべてのファイルをアップロードしました。");
    selectedFiles = [];
    uploadBtn.disabled = true;
    fileElem.value = '';
  };

  tokenClient.requestAccessToken({ prompt: 'consent' });
});
