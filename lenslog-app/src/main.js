import './style.css';
import Masonry from 'masonry-layout';
import exifr from 'exifr';
import Chart from 'chart.js/auto'; 

export const API_BASE = `/api`;

// 2. 어디서든 쓸 수 있는 URL 변환기 (초간단 버전)
window.getFullUrl = function(url) {
    if (!url) return url;
    
    // 과거 DB에 박제된 옛날 사진들 (http://localhost:5001/...) 강제 변환
    if (url.includes('localhost')) {
        // 도메인과 포트를 아예 떼어버리고 "/uploads/..." 형태의 상대 경로로 만듦
        return url.replace(/https?:\/\/localhost:5001/, '');
    }
    
    // 이미 '/' 로 시작하는 정상적인 데이터 (/uploads/...)는 그대로 통과
    return url;
};

let state = {
  bodyInventory: [], 
  lensInventory: [],
  rollInventory: [], 
  digitalPhotos: [] ,
  globalPhotos: []
};

const STANDARD_SHUTTERS = ["1/8000", "1/4000", "1/2000", "1/1000", "1/500", "1/250", "1/125", "1/60", "1/30", "1/15", "1/8", "1/4", "1/2", "1", "2", "4", "8", "15", "30", "Bulb"];
const STANDARD_APERTURES = ["f/1.2", "f/1.4", "f/1.8", "f/2", "f/2.8", "f/4", "f/5.6", "f/8", "f/11", "f/16", "f/22", "f/32"];

let currentTab = 'global';
let viewingUserId = null;

let msnry;
let pendingImageData = { url: null, is_raw: false, original_url: null, file_name: null }; 

let currentLensFilter = 'all'; 
let currentBodyFilter = 'all'; 

// === 🔑 인증 및 API 호출 유틸리티 ===
function getToken() { return localStorage.getItem('lenslog_token'); }

async function apiFetch(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('lenslog_token');
    alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
    location.reload();
  }
  if (data.status === 'error') throw new Error(data.message);
  return data;
}

// === 🚀 앱 초기화 및 데이터 로딩 ===
// === 🚀 앱 초기화 및 데이터 로딩 ===
async function initApp() {
  const token = getToken();
  if (!token) {
    document.getElementById('login-modal').style.display = 'flex';
    return;
  }
  
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'inline-block';

  try {
    const [bodiesRes, lensesRes, rollsRes, photosRes, globalRes] = await Promise.all([
      apiFetch('/inventory/bodies'),
      apiFetch('/inventory/lenses'),
      apiFetch('/rolls'),
      apiFetch('/photos'),
      apiFetch('/photos/global') // 글로벌 API 호출
    ]);

    state.bodyInventory = bodiesRes.data;
    state.lensInventory = lensesRes.data;
    state.globalPhotos = globalRes.data; // 글로벌 데이터 저장
    
    // 롤 배열 초기화
    state.rollInventory = rollsRes.data.map(r => ({
      ...r,
      slots: Array(r.maxFrames).fill(null)
    }));

    state.digitalPhotos = [];
    
    // 내 사진 데이터 분배
    photosRes.data.forEach(photo => {
      if (photo.rollId && photo.cutIndex !== null) {
        const roll = state.rollInventory.find(r => r.id === photo.rollId);
        if (roll && photo.cutIndex < roll.maxFrames) {
          roll.slots[photo.cutIndex] = photo;
        }
      } else {
        state.digitalPhotos.push(photo);
      }
    });

    updateDropdowns(); 
    
    const grid = document.querySelector('.grid');
    msnry = new Masonry(grid, { itemSelector: '.grid-item', gutter: 20, percentPosition: true, transitionDuration: 0 });
    
    // [추가됨] 앱 초기화 완료 시 '글로벌 대시보드' 탭 클릭 이벤트를 강제로 발생시켜 렌더링 트리거
    document.getElementById('tab-global').click();

  } catch (err) {
    console.error("데이터 로딩 실패:", err);
    alert("서버에서 데이터를 불러오지 못했습니다.");
  }
}

// === 🔐 로그인/회원가입/로그아웃 이벤트 ===
document.getElementById('login-submit-btn').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.status === 'success') {
      localStorage.setItem('lenslog_token', data.token);
      initApp(); // 로그인 성공 시 데이터 불러오기
    } else alert(data.message);
  } catch (e) { alert("서버 연결 실패"); }
});

document.getElementById('register-submit-btn').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.status === 'success') alert("가입 성공! 이제 로그인해주세요.");
    else alert(data.message);
  } catch (e) { alert("서버 연결 실패"); }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('lenslog_token');
  location.reload();
});

function updateDropdowns() {
  const lensOptions = state.lensInventory.map(lens => `<option value="${lens.id}">${lens.name}</option>`).join('');
  document.getElementById('input-lens').innerHTML = lensOptions;
  document.getElementById('filter-lens-select').innerHTML = `<option value="all">모든 렌즈</option>` + lensOptions;
  document.getElementById('filter-lens-select').value = currentLensFilter;

  const bodyOptions = state.bodyInventory.map(body => `<option value="${body.id}">${body.name}</option>`).join('');
  document.getElementById('input-body').innerHTML = bodyOptions;
  document.getElementById('filter-body-select').innerHTML = `<option value="all">모든 바디</option>` + bodyOptions;
  document.getElementById('filter-body-select').value = currentBodyFilter;

  // [수정] 롤 인벤토리 검사 및 안내 문구 출력 로직
  const rollSelect = document.getElementById('input-roll');
  if (state.rollInventory.length === 0) {
    rollSelect.innerHTML = `<option value="" disabled selected>⚠️ 인벤토리에 롤을 먼저 등록해주세요</option>`;
  } else {
    rollSelect.innerHTML = state.rollInventory.map(roll => `<option value="${roll.id}">${roll.name} (Max ${roll.maxFrames})</option>`).join('');
  }

  updateAvailableCutNumbers();
  applyDynamicGearConstraints();
  renderGallery();
}

function applyDynamicGearConstraints() {
  const bodyId = document.getElementById('input-body').value;
  const lensId = document.getElementById('input-lens').value;
  
  const shutterSelect = document.getElementById('input-aperture').closest('.form-group').parentNode.querySelector('#input-shutter');
  const apSelect = document.getElementById('input-aperture');

  // 셔터스피드 제약 계산
  const selectedBody = state.bodyInventory.find(b => b.id === bodyId);
  if (selectedBody && selectedBody.maxShutterSpeed && shutterSelect) {
    const maxIndex = STANDARD_SHUTTERS.indexOf(selectedBody.maxShutterSpeed);
    const available = maxIndex !== -1 ? STANDARD_SHUTTERS.slice(maxIndex) : STANDARD_SHUTTERS;
    shutterSelect.innerHTML = available.map(s => `<option value="${s}">${s}</option>`).join('');
  } else if (shutterSelect) {
    shutterSelect.innerHTML = STANDARD_SHUTTERS.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  // 조리개 제약 계산 (수치 기반 필터링)
  const apInput = document.getElementById('input-aperture');
  const apDatalist = document.getElementById('aperture-options');
  const selectedLens = state.lensInventory.find(l => l.id === lensId);
  
  if (selectedLens && selectedLens.maxAperture && selectedLens.minAperture && apDatalist) {
    const lensMaxNum = parseFloat(selectedLens.maxAperture.replace('f/', '')) || 0;
    const lensMinNum = parseFloat(selectedLens.minAperture.replace('f/', '')) || 99;

    // 표준 배열에서 수치상 범위 내에 있는 값만 필터링
    let available = STANDARD_APERTURES.filter(a => {
      const num = parseFloat(a.replace('f/', ''));
      return num >= lensMaxNum && num <= lensMinNum;
    });

    // 비표준 값(예: f/3.3)이 표준 배열에 없다면 배열 양끝에 강제 삽입
    if (!available.includes(selectedLens.maxAperture)) available.unshift(selectedLens.maxAperture);
    if (!available.includes(selectedLens.minAperture)) available.push(selectedLens.minAperture);

    apDatalist.innerHTML = available.map(a => `<option value="${a}">`).join('');
  } else if (apDatalist) {
    apDatalist.innerHTML = STANDARD_APERTURES.map(a => `<option value="${a}">`).join('');
  }
}

document.getElementById('input-body').addEventListener('change', applyDynamicGearConstraints);
document.getElementById('input-lens').addEventListener('change', applyDynamicGearConstraints);

function updateAvailableCutNumbers(editIndex = -1) {
    const rollId = document.getElementById('input-roll').value;
    if (!rollId) return;

    const roll = state.rollInventory.find(r => r.id === rollId);
    if (!roll || !roll.slots) return;

    const cutSelect = document.getElementById('input-cut-number');
    cutSelect.innerHTML = '';

    roll.slots.forEach((slot, index) => {
        if (slot === null || index === editIndex) {
            cutSelect.innerHTML += `<option value="${index}">Cut #${index + 1} ${index === editIndex ? '(수정 중)' : ''}</option>`;
        }
    });

    if (editIndex !== -1) cutSelect.value = editIndex;
    if (cutSelect.innerHTML === '') cutSelect.innerHTML = `<option value="" disabled selected>모든 컷 소진됨</option>`;
}

document.getElementById('input-roll').addEventListener('change', updateAvailableCutNumbers);

function renderGearManager() {
  const bodyListEl = document.getElementById('manager-body-list');
  bodyListEl.innerHTML = state.bodyInventory.map(body => `
    <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf2f7;">
      <span>${body.name}</span>
      <button class="delete-body-btn" data-id="${body.id}" style="background: #E53E3E; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
    </li>
  `).join('');

  const lensListEl = document.getElementById('manager-lens-list');
  lensListEl.innerHTML = state.lensInventory.map(lens => `
    <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf2f7;">
      <span>${lens.name}</span>
      <button class="delete-lens-btn" data-id="${lens.id}" style="background: #E53E3E; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
    </li>
  `).join('');

  const rollListEl = document.getElementById('manager-roll-list');
  rollListEl.innerHTML = state.rollInventory.map(roll => {
      const usedSlots = roll.slots.filter(s => s !== null).length;
      return `
      <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf2f7;">
        <span class="open-roll-detail" data-id="${roll.id}" style="color: #2B6CB0; cursor: pointer; font-weight: bold; text-decoration: underline;">
          ${roll.name} (${usedSlots}/${roll.maxFrames})
        </span>
        <button class="delete-roll-btn" data-id="${roll.id}" style="background: #E53E3E; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
      </li>`;
  }).join('');

  document.querySelectorAll('.delete-body-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    try {
      await apiFetch(`/inventory/bodies/${e.target.dataset.id}`, 'DELETE');
      state.bodyInventory = state.bodyInventory.filter(b => b.id !== e.target.dataset.id);
      updateDropdowns(); renderGearManager();
    } catch(err) { alert(err.message); }
  }));

  document.querySelectorAll('.delete-lens-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    try {
      await apiFetch(`/inventory/lenses/${e.target.dataset.id}`, 'DELETE');
      state.lensInventory = state.lensInventory.filter(l => l.id !== e.target.dataset.id);
      updateDropdowns(); renderGearManager();
    } catch(err) { alert(err.message); }
  }));

  document.querySelectorAll('.delete-roll-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    try {
      await apiFetch(`/rolls/${e.target.dataset.id}`, 'DELETE');
      state.rollInventory = state.rollInventory.filter(r => r.id !== e.target.dataset.id);
      updateDropdowns(); renderGearManager();
    } catch(err) { alert(err.message); }
  }));

  document.querySelectorAll('.open-roll-detail').forEach(btn => btn.addEventListener('click', (e) => {
      openRollDetailModal(e.target.dataset.id);
  }));
}

// 장비 추가 로직
document.getElementById('add-body-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-body-input').value.trim();
  const maxShutterSpeed = document.getElementById('new-body-max-shutter')?.value || null;
  if (!name) return;
  try {
    const res = await apiFetch('/inventory/bodies', 'POST', { name, maxShutterSpeed });
    state.bodyInventory.push(res.data);
    updateDropdowns(); renderGearManager(); document.getElementById('new-body-input').value = ''; 
  } catch(err) { alert(err.message); }
});

document.getElementById('add-lens-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-lens-input').value.trim();
  const maxAperture = document.getElementById('new-lens-max-ap')?.value || null;
  const minAperture = document.getElementById('new-lens-min-ap')?.value || null;
  if (!name) return;
  try {
    const res = await apiFetch('/inventory/lenses', 'POST', { name, maxAperture, minAperture });
    state.lensInventory.push(res.data);
    updateDropdowns(); renderGearManager(); document.getElementById('new-lens-input').value = ''; 
  } catch(err) { alert(err.message); }
});

document.getElementById('add-roll-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-roll-input').value.trim();
  const maxFrames = document.getElementById('new-roll-max').value;
  if (!name) return;
  try {
    const res = await apiFetch('/rolls', 'POST', { name, maxFrames });
    state.rollInventory.push({ ...res.data, slots: Array(res.data.maxFrames).fill(null) });
    updateDropdowns(); renderGearManager(); document.getElementById('new-roll-input').value = ''; 
  } catch(err) { alert(err.message); }
});

// === 롤 상세 및 퍼블리싱 렌더링 ===
function openRollDetailModal(rollId) {
    const roll = state.rollInventory.find(r => r.id === rollId);
    if (!roll) return;

    document.getElementById('roll-detail-title').innerText = `롤 관리: ${roll.name}`;
    const grid = document.getElementById('roll-slot-grid');
    grid.innerHTML = '';

    roll.slots.forEach((slotData, index) => {
        const div = document.createElement('div');
        div.style = "background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; position: relative;";

        if (slotData === null) {
            div.innerHTML = `
                <div style="height: 120px; background: #edf2f7; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: #a0aec0; margin-bottom: 10px;">빈 슬롯 (미기록)</div>
                <div style="font-weight: bold; text-align: center; color: #4a5568;">Cut #${index + 1}</div>`;
        } else {
            const matchedLens = state.lensInventory.find(l => l.id === slotData.lensId);
            const lensName = matchedLens ? matchedLens.name : "삭제된 렌즈";

            let imgDisplay = slotData.imageUrl 
                ? `<img src="${window.getFullUrl(slotData.imageUrl)}" style="width:100%; height:120px; object-fit:cover; border-radius:4px; margin-bottom:10px;">`
                : `<div style="height: 120px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: #718096; margin-bottom: 10px; cursor:pointer;" class="img-upload-trigger">+ 현상 이미지 매핑</div>`;

            const pubBtn = slotData.isPublished 
                ? `<button class="toggle-pub-btn" style="width: 100%; padding: 5px; background: #48bb78; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-top: 5px;">✔️ 메인 갤러리 노출 중</button>`
                : `<button class="toggle-pub-btn" style="width: 100%; padding: 5px; background: #cbd5e0; color: #4a5568; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-top: 5px;">❌ 미노출 (클릭시 발행)</button>`;

            const changeImgBtn = slotData.imageUrl 
                ? `<button class="change-img-trigger" style="width: 100%; padding: 5px; background: #E2E8F0; color: #4A5568; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-top: 5px; font-weight: bold;">🔄 사진 변경</button>` : '';

            div.innerHTML = `
                ${imgDisplay}
                <div style="font-weight: bold; color: #2d3748; margin-bottom: 5px;">Cut #${index + 1}</div>
                <div style="font-size: 11px; color: #718096;">${lensName} <br>${slotData.aperture} | ${slotData.shutterSpeed} <br>${slotData.notes}</div>
                ${slotData.imageUrl ? pubBtn : '<div style="font-size:10px; color:red; text-align:center; margin-top:5px;">이미지 매핑 필요</div>'}
                ${changeImgBtn}
                <input type="file" id="upload-${rollId}-${index}" accept="image/jpeg, image/png" style="display:none;">
            `;

            // 파일 매핑 로직
            const handleUploadClick = () => div.querySelector(`#upload-${rollId}-${index}`).click();
            if (div.querySelector('.img-upload-trigger')) div.querySelector('.img-upload-trigger').onclick = handleUploadClick;
            if (div.querySelector('.change-img-trigger')) div.querySelector('.change-img-trigger').onclick = handleUploadClick;

            div.querySelector(`#upload-${rollId}-${index}`).onchange = async (e) => {
                const file = e.target.files[0];
                if(!file) return;
                const base64 = await blobToBase64(file);
                
                try {
                    // 기본적으로 매핑 시 공유 상태(true)로 저장하도록 API 통일
                    await apiFetch(`/photos/${slotData.id}`, 'PUT', { imageUrl: base64, isPublished: true });
                    slotData.imageUrl = base64;
                    slotData.isPublished = true;
                    
                    // 글로벌 데이터 재요청 및 갱신
                    const globalRes = await apiFetch('/photos/global');
                    state.globalPhotos = globalRes.data;
                    
                    openRollDetailModal(rollId); renderGallery();
                } catch(err) { alert("사진 업로드 실패"); }
            };

            // 퍼블리싱 토글
            if (div.querySelector('.toggle-pub-btn')) {
                div.querySelector('.toggle-pub-btn').onclick = async () => {
                    try {
                        const newStatus = !slotData.isPublished;
                        await apiFetch(`/photos/${slotData.id}`, 'PUT', { isPublished: newStatus });
                        slotData.isPublished = newStatus;

                        // [추가] 글로벌 데이터 재요청 및 갱신
                        const globalRes = await apiFetch('/photos/global');
                        state.globalPhotos = globalRes.data;

                        openRollDetailModal(rollId); renderGallery();
                    } catch(err) { alert("상태 수정 실패"); }
                };
            }
        }
        grid.appendChild(div);
    });

    document.getElementById('roll-detail-modal').style.display = 'block';
}

// === 디지털 사진 파싱 및 업로드 (누락된 이벤트 리스너) ===
// === 디지털 사진 파싱 및 업로드 (자동 매칭 복구) ===
document.getElementById('auto-upload-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // UX 통제: 업로드 중임을 알리는 텍스트 표시
  document.getElementById('modal-title').innerText = "⏳ 서버 프로세싱 중입니다...";
  document.getElementById('logger-modal').style.display = "block";
  document.getElementById('log-btn').style.display = "none"; // 처리 중 제출 방지

  const formData = new FormData();
  formData.append('file', file);

  try {
    // 서버로 물리적 파일 전송 (multipart/form-data)
    const uploadRes = await fetch(`${API_BASE}/photos/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });

    const resData = await uploadRes.json();
    if (resData.status !== 'success') throw new Error(resData.message);

    // 서버가 파싱해서 던져준 데이터 구조분해 할당
    const { imageUrl, originalUrl, fileName, exif } = resData.data;
    const { aperture, shutterSpeed, body, lens, iso } = exif;

    let finalBodyId = "";
    let finalLensId = "";
    let isBodyMatched = false;
    let isLensMatched = false;

    if (body) {
      const existingBody = state.bodyInventory.find(b => b.name === body);
      if (existingBody) {
        finalBodyId = existingBody.id;
        isBodyMatched = true;
      } else {
        const res = await apiFetch('/inventory/bodies', 'POST', { name: body });
        state.bodyInventory.push(res.data);
        finalBodyId = res.data.id;
        isBodyMatched = true;
      }
    }

    if (lens) {
      const existingLens = state.lensInventory.find(l => l.name === lens);
      if (existingLens) {
        finalLensId = existingLens.id;
        isLensMatched = true;
      } else {
        const res = await apiFetch('/inventory/lenses', 'POST', { name: lens });
        state.lensInventory.push(res.data);
        finalLensId = res.data.id;
        isLensMatched = true;
      }
    }

    updateDropdowns();
    document.getElementById('log-btn').style.display = "block"; // 버튼 복구

    // 정보 불완전 시 보완 모달 상태로 전환
    if (!isBodyMatched || !isLensMatched || !iso) {
      document.getElementById('modal-title').innerText = "📸 디지털 장비 정보 보완";
      document.getElementById('log-btn').innerText = "디지털 사진 등록";

      document.getElementById('input-roll').closest('.form-group').style.display = 'none';
      document.getElementById('input-cut-number').closest('.form-group').style.display = 'none';

      const bodySelect = document.getElementById('input-body');
      if (finalBodyId) bodySelect.value = finalBodyId; else bodySelect.selectedIndex = 0;

      const lensSelect = document.getElementById('input-lens');
      if (finalLensId) lensSelect.value = finalLensId; else lensSelect.selectedIndex = 0;

      document.getElementById('input-aperture').value = aperture || '';
      document.getElementById('input-shutter').value = shutterSpeed || '';

      document.getElementById('input-iso').value = iso || '';
      document.getElementById('input-notes').value = fileName;

      // Base64 대신 서버에서 생성한 정적 이미지 URL을 저장
      pendingImageData = {
          url: imageUrl,
          is_digital_supplement: true
      };
      applyDynamicGearConstraints();
      return; 
    }

    document.getElementById('logger-modal').style.display = "none";

    const payload = {
        bodyId: finalBodyId,
        lensId: finalLensId,
        aperture: aperture,
        shutterSpeed: shutterSpeed,
        iso: iso,
        imageUrl: imageUrl, 
        originalUrl: originalUrl, // [신규] DB 저장을 위해 payload에 추가
        isDigital: true,
        isPublished: false,
        notes: fileName
    };
    const res = await apiFetch('/photos', 'POST', payload);
    
    state.digitalPhotos.push(res.data);
    renderGallery();

  } catch (err) {
    document.getElementById('logger-modal').style.display = "none";
    alert("서버 프로세싱에 실패했습니다: " + err.message);
  } finally {
    e.target.value = '';
  }
});

async function downloadFile(url, fileName) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("다운로드 응답 오류");
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = fileName || 'lenslog_photo';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        a.remove();
    } catch (e) {
        console.error("Blob 다운로드 실패, 새 창 열기로 대체:", e);
        window.open(url, '_blank'); // 실패 시 새 창에서 열도록 폴백
    }
}

// === 사진 기록 생성 로직 (POST /photos) ===
// === 사진 기록 생성 로직 (POST /photos) ===
document.getElementById('log-btn').addEventListener('click', async () => {
  const rollId = document.getElementById('input-roll').value;
  const cutIndex = parseInt(document.getElementById('input-cut-number').value);
  
  if (pendingImageData && pendingImageData.is_digital_supplement) {
      try {
          const payload = {
              bodyId: document.getElementById('input-body').value,
              lensId: document.getElementById('input-lens').value,
              aperture: document.getElementById('input-aperture').value,
              shutterSpeed: document.getElementById('input-shutter').value,
              iso: document.getElementById('input-iso').value, 
              imageUrl: pendingImageData.url,
              isDigital: true,
              isPublished: false, // 마이페이지 비공개 기본값 유지
              notes: document.getElementById('input-notes').value
          };
          const res = await apiFetch('/photos', 'POST', payload);
          state.digitalPhotos.push(res.data);
          
          document.getElementById('input-notes').value = '';
          document.getElementById('input-iso').value = '';
          document.getElementById('logger-modal').style.display = "none";
          renderGallery();
          return;
      } catch(e) { alert("사진 기록 실패"); return; }
  }

  // [핵심 추가] 롤이나 컷 번호가 올바르지 않으면(선택되지 않았다면) 제출 강제 차단
  if (!rollId || isNaN(cutIndex)) {
      alert("⚠️ 오류: 필름 롤과 컷 번호가 지정되지 않았습니다. 장비 관리에서 롤을 먼저 추가해주세요.");
      return; 
  }

  try {
      const payload = {
          bodyId: document.getElementById('input-body').value,
          lensId: document.getElementById('input-lens').value,
          rollId: rollId,
          cutIndex: cutIndex,
          aperture: document.getElementById('input-aperture').value,
          shutterSpeed: document.getElementById('input-shutter').value,
          iso: document.getElementById('input-iso').value, 
          notes: document.getElementById('input-notes').value
      };
      
      const res = await apiFetch('/photos', 'POST', payload);
      
      // 상태 업데이트
      const rollTarget = state.rollInventory.find(r => r.id === rollId);
      if (rollTarget) rollTarget.slots[cutIndex] = res.data;
      
      document.getElementById('input-notes').value = '';
      document.getElementById('input-iso').value = '';
      document.getElementById('logger-modal').style.display = "none";
      updateAvailableCutNumbers();
      renderGallery();
  } catch(err) { alert(err.message); }
});

// === 메인 갤러리 렌더링 로직 ===
function renderGallery() {
  const grid = document.querySelector('.grid');
  grid.innerHTML = ''; 

  let targetPhotos = [];

  if (currentTab === 'global') {
    targetPhotos = state.globalPhotos;
    
    if (viewingUserId) {
      targetPhotos = targetPhotos.filter(p => p.userId === viewingUserId);
      const userName = targetPhotos.length > 0 && targetPhotos[0].user ? targetPhotos[0].user.username : '알 수 없음';
      document.getElementById('profile-username').innerText = `📸 ${userName}님의 갤러리`;
      document.getElementById('user-profile-header').style.display = 'flex';
    } else {
      document.getElementById('user-profile-header').style.display = 'none';
    }
  } else {
    // 마이페이지 데이터 소스 (디지털 사진 포함)
    targetPhotos = [...state.digitalPhotos];
    
    state.rollInventory.forEach(roll => {
        roll.slots.forEach((slot, index) => {
            // [수정] 마이페이지에서는 공유 여부(isPublished)에 상관없이 이미지가 있는 모든 컷을 렌더링합니다.
            if (slot !== null && slot.imageUrl) {
                targetPhotos.push({
                    ...slot,
                    is_film: true,
                    roll_name: roll.name,
                    cut_number: index + 1
                });
            }
        });
    });
  }
  renderDashboard(targetPhotos);

  // 장비 필터 적용
  let filteredPhotos = targetPhotos;
  if (currentBodyFilter !== 'all') filteredPhotos = filteredPhotos.filter(p => p.bodyId === currentBodyFilter);
  if (currentLensFilter !== 'all') filteredPhotos = filteredPhotos.filter(p => p.lensId === currentLensFilter);

  filteredPhotos.forEach(photo => {
    const bodyName = photo.body ? photo.body.name : (state.bodyInventory.find(b => b.id === photo.bodyId)?.name || "삭제된 바디");
    const lensName = photo.lens ? photo.lens.name : (state.lensInventory.find(l => l.id === photo.lensId)?.name || "삭제된 렌즈");
    const authorName = photo.user ? photo.user.username : "Me";
    
    let sourceTag = photo.is_film ? `🎞️ ${photo.roll_name || '필름'}` : `📷 ${bodyName}`;
    let cutDisplay = photo.is_film ? `Cut #${photo.cut_number || '?'}` : `Photo #${photo.id.slice(-4)}`;

    const div = document.createElement('div');
    div.className = 'grid-item';
    
    let imageHtml = `<img src="${window.getFullUrl(photo.imageUrl)}" style="width: 100%; height: auto; border-radius: 4px; margin-bottom: 5px; display: block;">`;
    const notesLower = (photo.notes || "").toLowerCase();
    const isRawBadge = photo.isDigital && (notesLower.includes('.dng') || notesLower.includes('.cr2') || notesLower.includes('.nef') || notesLower.includes('.arw'));
    const rawBadge = isRawBadge ? `<span style="background:#E53E3E; color:white; padding:2px 4px; border-radius:3px; font-size:10px; margin-left:5px;">RAW</span>` : '';
    
    // 버튼 UI: 마이페이지일 때 퍼블리싱 상태 버튼과 삭제 버튼을 나란히 배치
    let actionButtons = '';
    if (currentTab === 'mypage') {
        const pubStatusText = photo.isPublished ? '🌐 공유 중' : '🔒 나만 보기';
        const pubBtnColor = photo.isPublished ? '#3182CE' : '#A0AEC0'; // 파란색(공유중), 회색(비공개)
        
        actionButtons = `
            <div style="margin-top:8px; display:flex; gap:5px;">
                <button class="toggle-pub-gallery-btn no-modal" style="flex:1; padding:4px 8px; background:${pubBtnColor}; color:white; border:none; font-size:11px; border-radius:4px; font-weight:bold; cursor:pointer;">${pubStatusText}</button>
                <button class="delete-gallery-btn no-modal" style="padding:4px 8px; background:#E53E3E; color:white; border:none; font-size:11px; border-radius:4px; font-weight:bold; cursor:pointer;">🗑️ 삭제</button>
            </div>
        `;
    } else {
        actionButtons = `<div class="author-link no-modal" data-userid="${photo.userId}" style="margin-top:8px; font-size:12px; font-weight:bold; color:#2B6CB0; cursor:pointer; text-decoration:underline;">Photographed by ${authorName}</div>`;
    }

    const isoDisplay = photo.iso ? photo.iso : '?';

    div.innerHTML = `
      ${imageHtml}
      <strong>${cutDisplay}</strong> ${rawBadge}<br>
      <span style="font-size: 13px; font-weight: bold; color: #2C3E50;">${sourceTag}</span><br>
      <span style="font-size: 12px; color: #666;">🔍 ${lensName}</span><br>
      <small style="color: #999;">${photo.notes || ''}</small><br>
      ${actionButtons}
    `;

    // 마이페이지 전용 이벤트 리스너 세팅
    if (currentTab === 'mypage') {
      
      // 1. 퍼블리싱 (공유/비공개) 상태 변경 이벤트
      div.querySelector('.toggle-pub-gallery-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const newStatus = !photo.isPublished;
          // 백엔드 API 업데이트
          await apiFetch(`/photos/${photo.id}`, 'PUT', { isPublished: newStatus });
          photo.isPublished = newStatus;
          
          if (photo.is_film) {
              const targetRoll = state.rollInventory.find(r => r.id === photo.rollId);
              if (targetRoll && targetRoll.slots[photo.cutIndex]) {
                  targetRoll.slots[photo.cutIndex].isPublished = newStatus;
              }
          }

          // 동기화를 위해 글로벌 배열 데이터를 백엔드에서 다시 불러옴
          const globalRes = await apiFetch('/photos/global');
          state.globalPhotos = globalRes.data;
          
          renderGallery(); // 화면 재렌더링
        } catch (err) { alert("상태 변경에 실패했습니다."); }
      });

      // 2. 삭제 이벤트
      div.querySelector('.delete-gallery-btn').addEventListener('click', async (e) => {
        e.stopPropagation(); 
        if (confirm("서버에서 사진을 완전히 삭제하시겠습니까?")) {
          try {
            await apiFetch(`/photos/${photo.id}`, 'DELETE');
            if (photo.is_film) {
              const targetRoll = state.rollInventory.find(r => r.id === photo.rollId);
              targetRoll.slots[photo.cutIndex] = null;
            } else {
              state.digitalPhotos = state.digitalPhotos.filter(p => p.id !== photo.id);
            }
            state.globalPhotos = state.globalPhotos.filter(p => p.id !== photo.id); // 글로벌 상태 동기화
            renderGallery();
          } catch (err) { alert(err.message); }
        }
      });
    }

    // 글로벌 대시보드 전용 이벤트
    if (currentTab === 'global') {
      div.querySelector('.author-link').addEventListener('click', (e) => {
        e.stopPropagation();
        viewingUserId = e.target.getAttribute('data-userid'); 
        renderGallery(); 
      });
    }

    // 모달 호출 이벤트
    div.addEventListener('click', (e) => {
      if (e.target.closest('.no-modal')) return;
      openDetailModal(photo, (photo.is_film ? sourceTag : "바디: " + bodyName), lensName, imageHtml, rawBadge, cutDisplay);
    });

    grid.appendChild(div);
  });

  if (msnry) { 
      msnry.destroy(); // 기존 레이아웃 인스턴스를 완전히 파기
  }
  
  // 새롭게 DOM에 추가된 요소들을 바탕으로 다시 그리드 계산
  msnry = new Masonry(grid, { 
      itemSelector: '.grid-item', 
      gutter: 20, 
      percentPosition: true, 
      transitionDuration: 0 
  });

  // 이미지 비동기 로딩 완료 시 레이아웃 재정렬 (기존 유지)
  grid.querySelectorAll('img').forEach(img => {
    img.onload = () => { if (msnry) msnry.layout(); };
    if (img.complete) img.onload();
  });
}
function openDetailModal(photo, sourceTag, lensName, imageHtml, rawBadge, cutDisplay) {
  const modal = document.getElementById('detail-modal');
  const modalContent = modal.querySelector('.modal-content'); 
  const imgContainer = document.getElementById('detail-image-container');
  const metaContainer = document.getElementById('detail-metadata');

  // 부모 오버레이 스크롤 및 정렬 설정
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'flex-start'; 
  modal.style.overflowY = 'auto';        
  modal.style.padding = '40px 20px';     

  // 컨텐츠 박스 설정
  modalContent.style.marginTop = '0';    
  modalContent.style.marginBottom = '0'; 
  modalContent.style.marginInline = 'auto'; 
  modalContent.style.maxHeight = 'none';
  modalContent.style.height = 'auto';

  imgContainer.innerHTML = imageHtml;
  
  const imgElement = imgContainer.querySelector('img');
  if (imgElement) {
      imgElement.style.maxHeight = '75vh';      
      imgElement.style.objectFit = 'contain';   
      imgElement.style.width = 'auto';          
      imgElement.style.maxWidth = '100%';       
      imgElement.style.display = 'block';       
      imgElement.style.margin = '0 auto 15px auto'; 
      imgElement.style.cursor = 'zoom-in';
      
      // 부드러운 확대/축소 애니메이션을 위한 CSS transition 속성 추가
      imgElement.style.transition = 'transform 0.25s ease-in-out, max-height 0.25s ease-in-out';
      imgElement.style.transformOrigin = 'center center';

      let isZoomed = false;
      imgElement.addEventListener('click', () => {
          isZoomed = !isZoomed;
          if (isZoomed) {
              // 모달 창 내부 영역을 가득 채우도록 확대 가속화
              imgElement.style.maxHeight = '85vh';
              imgElement.style.transform = 'scale(1.08)';
              imgElement.style.cursor = 'zoom-out';
          } else {
              // 원래 기본 상세 크기로 축소 복귀
              imgElement.style.maxHeight = '75vh';
              imgElement.style.transform = 'scale(1)';
              imgElement.style.cursor = 'zoom-in';
          }
      });
  }
  
  const hasOriginal = photo.originalUrl ? true : false;
  const originalBtnDisplay = hasOriginal ? 'inline-flex' : 'none';
  
  const originalFileName = photo.notes || 'photo.jpg';
  const ext = originalFileName.split('.').pop().toLowerCase();
  const isRawUploaded = ['dng', 'cr2', 'nef', 'arw'].includes(ext);

  let buttonsHtml = '';

  if (photo.isDigital) {
    if (isRawUploaded && photo.originalUrl) {
      // RAW 파일로 업로드된 경우: 압축 버전과 RAW 원본 두 가지 모두 표시
      buttonsHtml = `
        <button id="btn-download-resampled" style="padding: 10px 15px; background: #E2E8F0; color: #2D3748; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px;">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
          압축 버전 다운로드
        </button>
        <button id="btn-download-original" style="padding: 10px 15px; background: #3182CE; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px;">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
          RAW 원본 다운로드
        </button>
      `;
    } else {
      // JPG, PNG 등 일반 파일로 업로드된 경우: 원본 버튼 1개만 표시
      buttonsHtml = `
        <button id="btn-download-original" style="padding: 10px 15px; background: #3182CE; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px;">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
          원본 다운로드
        </button>
      `;
    }
  } else {
    // 필름 로깅 사진인 경우
    buttonsHtml = `
        <button id="btn-download-resampled" style="padding: 10px 15px; background: #3182CE; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px;">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
          사진 다운로드
        </button>
    `;
  }

  metaContainer.innerHTML = `
    <h3 style="margin-top: 0; color: #2C3E50;">${sourceTag} ${rawBadge}</h3>
    <p style="margin: 5px 0;"><strong>${cutDisplay}</strong></p>
    <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 15px 0;">
    <p style="margin: 5px 0;"><strong>렌즈:</strong> ${lensName}</p>
    <p style="margin: 5px 0;"><strong>조리개:</strong> ${photo.aperture}</p>
    <p style="margin: 5px 0;"><strong>셔터스피드:</strong> ${photo.shutterSpeed}</p>
    <p style="margin: 5px 0;"><strong>ISO:</strong> ${photo.iso || '기록 없음'}</p>
    <p style="margin: 5px 0; color: #718096; font-size: 13px;">${photo.notes || ''}</p>
    
    ${currentTab === 'mypage' ? `
    <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
      <button id="btn-rotate-ccw" style="padding: 6px 12px; background: #EDF2F7; color: #4A5568; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">↺ 좌로 회전</button>
      <button id="btn-rotate-cw" style="padding: 6px 12px; background: #EDF2F7; color: #4A5568; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">↻ 우로 회전</button>
    </div>` : ''}

    <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
      ${buttonsHtml}
    </div>
  `;

  // 다운로드 이벤트 리스너 바인딩
  const btnResampled = document.getElementById('btn-download-resampled');
  if (btnResampled) {
    btnResampled.addEventListener('click', () => {
      const fileName = photo.is_film ? 'film_photo.jpg' : ('web_' + originalFileName);
      downloadFile(window.getFullUrl(photo.imageUrl), fileName);
    });
  }

  const btnOriginal = document.getElementById('btn-download-original');
  if (btnOriginal) {
    btnOriginal.addEventListener('click', () => {
      const downloadUrl = photo.originalUrl ? window.getFullUrl(photo.originalUrl) : window.getFullUrl(photo.imageUrl);
      downloadFile(downloadUrl, originalFileName);
    });
  }

  // --- 이미지 회전 처리 로직 ---
  const handleRotate = async (direction) => {
    try {
      // 1. 서버에 회전 요청
      const res = await apiFetch(`/photos/${photo.id}/rotate`, 'PUT', { direction });
      
      if (res.status === 'success') {
        // 2. 브라우저 캐시 무력화 (Cache Busting)
        // URL 뒤에 쿼리파라미터(?t=시간)를 붙여 브라우저가 완전히 새로운 파일로 인식하게 만듦
       if (res.newImageUrl) {
          // Base64인 경우 서버에서 넘겨준 새 문자열로 교체
          photo.imageUrl = res.newImageUrl;
        } else {
          // 물리적 파일인 경우 기존처럼 타임스탬프를 붙여 캐시 무력화
          const ts = new Date().getTime();
          photo.imageUrl = photo.imageUrl.split('?')[0] + `?t=${ts}`;
          if (photo.originalUrl) {
            photo.originalUrl = photo.originalUrl.split('?')[0] + `?t=${ts}`;
          }
        }
          
        if (photo.is_film) {
            const targetRoll = state.rollInventory.find(r => r.id === photo.rollId);
            if (targetRoll && targetRoll.slots[photo.cutIndex]) {
                targetRoll.slots[photo.cutIndex].imageUrl = photo.imageUrl;
                if (photo.originalUrl) {
                    targetRoll.slots[photo.cutIndex].originalUrl = photo.originalUrl;
                }
            }
        }
        
        const globalPhoto = state.globalPhotos.find(p => p.id === photo.id);
        if (globalPhoto) {
          globalPhoto.imageUrl = photo.imageUrl;
          if (globalPhoto.originalUrl) globalPhoto.originalUrl = photo.originalUrl;
        }

        if (imgElement) {
          imgElement.src = window.getFullUrl(photo.imageUrl);
        }

        renderGallery();
      }
    } catch (err) {
      alert("회전에 실패했습니다: " + err.message);
    }
  };

  const btnCcw = document.getElementById('btn-rotate-ccw');
  if (btnCcw) btnCcw.addEventListener('click', () => handleRotate('ccw'));

  const btnCw = document.getElementById('btn-rotate-cw');
  if (btnCw) btnCw.addEventListener('click', () => handleRotate('cw'));

  document.body.style.overflow = 'hidden'; 
}

document.getElementById('filter-lens-select').addEventListener('change', (e) => { currentLensFilter = e.target.value; renderGallery(); });
document.getElementById('filter-body-select').addEventListener('change', (e) => { currentBodyFilter = e.target.value; renderGallery(); });

// === 📊 통계 대시보드 렌더링 ===
let lensChartInstance = null;
let apChartInstance = null;

function renderDashboard(photos) {
  let dashContainer = document.getElementById('mypage-dashboard');
  
  // 1. 대시보드 컨테이너가 없으면 그리드 상단에 동적 생성
  if (!dashContainer) {
    const grid = document.querySelector('.grid');
    if (!grid) return;
    
    dashContainer = document.createElement('div');
    dashContainer.id = 'mypage-dashboard';
    dashContainer.style.display = 'flex';
    dashContainer.style.flexWrap = 'wrap';
    dashContainer.style.gap = '20px';
    dashContainer.style.marginBottom = '30px';
    dashContainer.style.padding = '20px';
    dashContainer.style.backgroundColor = '#F7FAFC';
    dashContainer.style.borderRadius = '12px';
    dashContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
    dashContainer.style.height = 'auto'; // 고정 높이 해제
    
    // 차트 컨테이너 높이를 200px로 제한하고, 파이 차트의 최대 너비(max-width) 제한
    dashContainer.innerHTML = `
      <div style="flex: 1; min-width: 250px; display: flex; flex-direction: column; align-items: center;">
        <h4 style="margin: 0 0 10px 0; color: #2D3748; font-size: 14px;">📸 렌즈 사용 빈도</h4>
        <div style="position: relative; width: 100%; max-width: 250px; height: 180px;">
            <canvas id="chart-lens"></canvas>
        </div>
      </div>
      <div style="flex: 1; min-width: 250px; display: flex; flex-direction: column; align-items: center;">
        <h4 style="margin: 0 0 10px 0; color: #2D3748; font-size: 14px;">💡 조리개 분포</h4>
        <div style="position: relative; width: 100%; height: 180px;">
            <canvas id="chart-aperture"></canvas>
        </div>
      </div>
    `;
    grid.parentNode.insertBefore(dashContainer, grid);
  }

  // 2. 글로벌 탭이거나 사진이 없으면 대시보드 숨김
  if (currentTab !== 'mypage' || photos.length === 0) {
    dashContainer.style.display = 'none';
    return;
  }
  
  dashContainer.style.display = 'flex';

  // 3. 통계 데이터 집계
  const lensCount = {};
  const apCount = {};

  photos.forEach(p => {
    // 렌즈 이름 집계
    const lensName = p.lens ? p.lens.name : (state.lensInventory.find(l => l.id === p.lensId)?.name || "알 수 없음");
    lensCount[lensName] = (lensCount[lensName] || 0) + 1;
    
    // 조리개 값 집계 (소수점 정리 포함)
    const ap = p.aperture || '수동/기타';
    apCount[ap] = (apCount[ap] || 0) + 1;
  });

  // 4. 렌즈 원형(Doughnut) 차트 렌더링
  if (lensChartInstance) lensChartInstance.destroy();
  const ctxLens = document.getElementById('chart-lens').getContext('2d');
  lensChartInstance = new Chart(ctxLens, {
    type: 'doughnut',
    data: {
      labels: Object.keys(lensCount),
      datasets: [{
        data: Object.values(lensCount),
        backgroundColor: ['#3182CE', '#E53E3E', '#38A169', '#D69E2E', '#805AD5', '#319795', '#DD6B20']
      }]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false, 
      layout: { padding: 5 }, // 여백 축소
      plugins: { 
        legend: { 
          position: 'bottom', // 옆으로 삐져나가지 않도록 아래로 이동
          labels: { boxWidth: 12, font: { size: 10 } } 
        } 
      } 
    }
  });

  // 5. 조리개 막대(Bar) 차트 렌더링
  if (apChartInstance) apChartInstance.destroy();
  const ctxAp = document.getElementById('chart-aperture').getContext('2d');
  
  // 조리개 값을 숫자 오름차순으로 정렬 (예: f/1.4 -> f/2.8 -> f/8)
  const sortedApKeys = Object.keys(apCount).sort((a, b) => {
    const numA = parseFloat(a.replace(/[^\d.]/g, '')) || 999;
    const numB = parseFloat(b.replace(/[^\d.]/g, '')) || 999;
    return numA - numB;
  });

  apChartInstance = new Chart(ctxAp, {
    type: 'bar',
    data: {
      labels: sortedApKeys,
      datasets: [{
        label: '사진 수',
        data: sortedApKeys.map(k => apCount[k]),
        backgroundColor: '#4A5568',
        borderRadius: 4
      }]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
} 

function blobToBase64(blobOrUrl) {
  return new Promise(async (resolve) => {
    if (!blobOrUrl) return resolve(null);
    try {
      let blob = blobOrUrl;
      if (typeof blobOrUrl === 'string') {
        const res = await fetch(blobOrUrl); blob = await res.blob();
      }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null); 
      reader.readAsDataURL(blob);
    } catch (e) { resolve(null); }
  });
}
// === 탭 전환 리스너 ===
document.getElementById('tab-global').addEventListener('click', () => {
  currentTab = 'global';
  viewingUserId = null; // 글로벌 탭을 다시 누르면 필터가 해제되도록 추가
  document.getElementById('user-profile-header').style.display = 'none'; // 프로필 헤더 숨김
  document.getElementById('tab-global').style.background = '#1A365D';
  document.getElementById('tab-global').style.color = 'white';
  document.getElementById('tab-mypage').style.background = '#E2E8F0';
  document.getElementById('tab-mypage').style.color = '#2D3748';
  document.getElementById('open-settings-btn').style.display = 'none'; 
  document.getElementById('open-modal-btn').style.display = 'none'; 
  renderGallery();
});

// 프로필 보기 상태에서 '전체 보기'로 돌아가는 버튼 이벤트 추가
document.getElementById('back-to-global-btn').addEventListener('click', () => {
  document.getElementById('tab-global').click();
});

document.getElementById('tab-mypage').addEventListener('click', () => {
  currentTab = 'mypage';
  document.getElementById('tab-mypage').style.background = '#1A365D';
  document.getElementById('tab-mypage').style.color = 'white';
  document.getElementById('tab-global').style.background = '#E2E8F0';
  document.getElementById('tab-global').style.color = '#2D3748';
  document.getElementById('open-settings-btn').style.display = 'inline-block';
  document.getElementById('open-modal-btn').style.display = 'flex';
  renderGallery();
});

// === 모달 제어 이벤트 ===
const gatewayModal = document.getElementById('gateway-modal');
const loggerModal = document.getElementById('logger-modal');
const settingsModal = document.getElementById('settings-modal');
const detailModal = document.getElementById('detail-modal'); 
const rollDetailModal = document.getElementById('roll-detail-modal'); 

// 모든 모달 닫기 및 배경 스크롤 복구 공통 함수
const closeAllModals = () => {
  gatewayModal.style.display = "none";
  loggerModal.style.display = "none";
  settingsModal.style.display = "none";
  detailModal.style.display = "none";
  rollDetailModal.style.display = "none";
  document.body.style.overflow = ''; // 스크롤 잠금 해제
};

document.getElementById('open-modal-btn').onclick = () => { 
  gatewayModal.style.display = "block"; 
  document.body.style.overflow = 'hidden'; // 스크롤 잠금
};

document.getElementById('btn-digital-upload').onclick = () => {
  gatewayModal.style.display = "none";
  document.body.style.overflow = ''; 
  document.getElementById('auto-upload-input').click();
};

document.getElementById('btn-film-logging').onclick = () => {
  gatewayModal.style.display = "none";
  pendingImageData = { url: null, is_digital_supplement: false };
  document.getElementById('input-roll').closest('.form-group').style.display = 'block';
  document.getElementById('input-cut-number').closest('.form-group').style.display = 'block';
  document.getElementById('modal-title').innerText = "🎞️ 필름 컷 현장 로깅"; 
  document.getElementById('input-notes').value = '';
  updateAvailableCutNumbers(); 
  loggerModal.style.display = "block";
  document.body.style.overflow = 'hidden'; // 스크롤 잠금
};

document.getElementById('open-settings-btn').onclick = () => { 
  renderGearManager(); 
  settingsModal.style.display = "block"; 
  document.body.style.overflow = 'hidden'; // 스크롤 잠금
};

// 닫기 버튼 이벤트 연결
document.getElementById('close-gateway-btn').onclick = closeAllModals;
document.getElementById('close-modal-btn').onclick = closeAllModals;
document.getElementById('close-settings-btn').onclick = closeAllModals;
document.getElementById('close-detail-btn').onclick = closeAllModals;
document.getElementById('close-roll-detail-btn').onclick = closeAllModals;

// 모달 바깥 배경 클릭 시 닫기
window.onclick = (event) => { 
  if ([gatewayModal, loggerModal, settingsModal, rollDetailModal, detailModal].includes(event.target)) {
    closeAllModals();
  }
};

// 폼 제출 완료 시 모달 닫고 스크롤 복구 (기존 log-btn 이벤트 로직 안에도 아래 코드가 실행되도록 보완)
const originalLogBtnClick = document.getElementById('log-btn').onclick;
if(originalLogBtnClick) {
  // 버튼 클릭 후 창이 닫힐 때 스크롤을 풀어주기 위함
  document.getElementById('log-btn').addEventListener('click', () => {
    setTimeout(() => { document.body.style.overflow = ''; }, 500);
  });
}

// 초기화 시작
initApp();