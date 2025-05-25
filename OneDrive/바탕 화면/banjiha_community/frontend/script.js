// frontend/script.js

// IMPORTANT: 배포 시 이 API_BASE_URL을 실제 백엔드 서버의 공개 URL로 변경해야 합니다.
// 예: const API_BASE_URL = 'http://당신의_VM_공용_IP_주소:3000/api';
// 예: const API_BASE_URL = 'https://your-backend-api-url.com/api'; (도메인 & HTTPS 사용 시)
const API_BASE_URL = 'http://localhost:3000/api'; // 로컬 개발 중 기본값

// DOM 요소 캐싱 (모든 HTML 페이지에 이 ID들이 있다고 가정)
const mainContentArea = document.getElementById('mainContentArea');
const navLinks = document.querySelectorAll('nav ul li a');
const globalSearchInput = document.getElementById('globalSearchInput');
const globalSearchButton = document.getElementById('globalSearchButton');

// Rooms 페이지 관련 DOM 요소 (Rooms 페이지에서만 존재)
const createRoomModal = document.getElementById('createRoomModal');
const closeButton = createRoomModal ? createRoomModal.querySelector('.close-button') : null;
const createRoomForm = document.getElementById('createRoomForm');

// rooms 데이터를 캐싱하여 불필요한 API 호출 줄이기
let cachedRooms = [];

// 현재 게시물 정렬 기준 (기본값: 최신순)
let currentSortBy = 'date';


// --- 공통 유틸리티 함수 ---

/**
 * HTML 특수 문자를 안전하게 이스케이프 처리 (순수 텍스트 표시용)
 * @param {string} text - 처리할 원본 텍스트
 * @returns {string} 이스케이프 처리된 텍스트
 */
function escapeHTML(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

/**
 * 방 이름 가져오기 (room_slug를 통한 조회)
 * @param {string} roomSlug - 방의 slug
 * @returns {Promise<string>} 방 이름 (예: "[일상 이야기 방] " 또는 빈 문자열)
 */
async function getRoomName(roomSlug) {
    if (!roomSlug) return '';
    try {
        const rooms = await fetchRooms();
        const room = rooms.find(r => r.slug === roomSlug);
        return room ? `[${escapeHTML(room.name)}] ` : '';
    } catch (e) {
        console.error('Error getting room name:', e);
        return '';
    }
}

/**
 * 방 목록을 가져오거나 캐시된 데이터를 반환
 * @returns {Promise<Array>} 방 목록 배열
 */
async function fetchRooms() {
    if (cachedRooms.length > 0) return cachedRooms;
    try {
        const response = await fetch(`${API_BASE_URL}/rooms`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.message === 'success') {
            cachedRooms = result.data;
            return cachedRooms;
        } else {
            throw new Error(result.error || 'Failed to fetch rooms');
        }
    } catch (error) {
        console.error('Error fetching rooms:', error);
        throw error;
    }
}


/**
 * 카테고리/슬러그에 따른 페이지 제목 반환
 * @param {string} category - 카테고리 문자열
 * @param {string} [roomSlug=null] - roomSlug (있는 경우)
 * @returns {Promise<string>} 페이지 제목
 */
async function getCategoryTitle(category, roomSlug = null) {
    if (roomSlug) {
        try {
            const rooms = await fetchRooms();
            const room = rooms.find(r => r.slug === roomSlug);
            return room ? `${escapeHTML(room.name)} 게시물` : `${escapeHTML(roomSlug)} 게시물`;
        } catch (e) {
            console.error('Error getting room name for title:', e);
            return `${escapeHTML(roomSlug)} 게시물`;
        }
    }
    if (category === 'main') return '최신 게시물';
    if (category === 'freeboard') return '자유 게시판';
    if (category === 'rooms') return '여러 방 들';
    if (category === 'notice') return '공지사항';
    if (category === 'search') return '검색 결과';
    return '게시판';
}


// --- 게시물 목록 관련 함수 ---

/**
 * 게시물 목록을 렌더링하는 함수 (카테고리별 필터링, 정렬, room_slug 필터링 포함)
 * @param {string} category - 조회할 게시물 카테고리
 * @param {string} [roomSlug=null] - rooms 카테고리일 경우 특정 방의 slug
 * @param {string} [sortBy='date'] - 정렬 기준 ('date' 또는 'likes')
 */
async function renderPostList(category = 'main', roomSlug = null, sortBy = 'date') {
    currentSortBy = sortBy;
    mainContentArea.innerHTML = `<h2>${await getCategoryTitle(category, roomSlug)}</h2><p style="text-align: center; color: #777;">게시물을 불러오는 중입니다...</p>`;
    
    try {
        let url = `${API_BASE_URL}/posts?category=${category}&sortBy=${sortBy}`;
        if (roomSlug) url += `&roomSlug=${roomSlug}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();

        if (result.message === 'success') {
            const posts = result.data;
            let pageTitle = await getCategoryTitle(category, roomSlug);
            
            let writeButtonHtml = '';
            if (category === 'main') writeButtonHtml = `<button class="write-button" onclick="location.href='write.html?category=main'">새 글 쓰기</button>`;
            else if (category === 'freeboard') writeButtonHtml = `<button class="write-button" onclick="location.href='write.html?category=freeboard'">새 글 쓰기</button>`;
            else if (category === 'rooms' && roomSlug) writeButtonHtml = `<button class="write-button" onclick="location.href='write.html?category=rooms&roomSlug=${encodeURIComponent(roomSlug)}'">이 방에 글 쓰기</button>`;
            
            let backButtonHtml = roomSlug ? `<button class="back-button" onclick="window.location.hash = '#rooms'">방 목록으로</button>` : '';
            
            let sortButtonsHtml = '';
            if (!['main', 'notice', 'search'].includes(category)) {
                sortButtonsHtml = `
                    <div class="sort-options">
                        <button class="sort-button ${sortBy === 'date' ? 'active' : ''}" onclick="changeSortOrder('${category}', '${roomSlug || ''}', 'date')">최신순</button>
                        <button class="sort-button ${sortBy === 'likes' ? 'active' : ''}" onclick="changeSortOrder('${category}', '${roomSlug || ''}', 'likes')">좋아요순</button>
                    </div>
                `;
            }
            
            let postListHtml = `
                <h2>
                    ${pageTitle}
                    ${writeButtonHtml}
                </h2>
                ${backButtonHtml}
                ${sortButtonsHtml}
                <ul class="post-list" id="postList">
            `;
            if (posts.length === 0) postListHtml += '<p class="no-posts">아직 작성된 게시물이 없습니다. 첫 글을 작성해보세요!</p>';
            else {
                for (const post of posts) {
                    const roomName = await getRoomName(post.room_slug);
                    postListHtml += `<li data-post-id="${post.id}"><div class="post-header"><div class="title">${roomName}${escapeHTML(post.title)}</div><div class="meta">${escapeHTML(post.author)} | ${escapeHTML(post.date.substring(0, 10))} | ❤️ ${post.likes}</div></div></li>`;
                }
            }
            postListHtml += `</ul>`;
            mainContentArea.innerHTML = postListHtml;

            attachPostListEventListeners();
        } else {
            mainContentArea.innerHTML = `<p class="error-message">게시물 목록을 불러오는데 실패했습니다: ${result.error || '알 수 없는 오류'}</p>`;
        }
    } catch (error) {
        console.error(`Error fetching posts for category ${category} (roomSlug: ${roomSlug}):`, error);
        mainContentArea.innerHTML = `<p class="error-message">서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.<br>오류 상세: ${error.message}</p>`;
    }
}

/**
 * 정렬 기준 변경 함수
 * @param {string} category - 현재 카테고리
 * @param {string} roomSlug - 현재 방 슬러그
 * @param {string} sortBy - 새로운 정렬 기준 ('date' 또는 'likes')
 */
function changeSortOrder(category, roomSlug, sortBy) {
    if (roomSlug) window.location.hash = `#rooms-${roomSlug}?sortBy=${sortBy}`;
    else window.location.hash = `#${category}?sortBy=${sortBy}`;
}

/**
 * 게시물 목록에 클릭 이벤트 리스너를 연결하는 함수
 */
function attachPostListEventListeners() {
    document.querySelectorAll('#postList li').forEach(item => {
        item.removeEventListener('click', handlePostListClick); // 중복 방지
        item.addEventListener('click', handlePostListClick);
    });
}

/**
 * 게시물 목록에서 게시물 클릭 시 상세 페이지로 이동하는 핸들러
 * @param {Event} event - 클릭 이벤트 객체
 */
function handlePostListClick(event) {
    const postId = event.currentTarget.closest('li')?.dataset.postId;
    if (postId) window.location.hash = `#post-${postId}`;
}


// --- 게시물 상세 페이지 관련 함수 ---

async function renderPostDetail(postId) {
    mainContentArea.innerHTML = `<h2>게시물 상세</h2><p style="text-align: center; color: #777;">게시물 상세 정보를 불러오는 중입니다...</p>`;
    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();

        if (result.message === 'success') {
            const { post, comments } = result.data;
            if (!post) {
                mainContentArea.innerHTML = `<h2>게시물을 찾을 수 없습니다.</h2><button class="back-button" onclick="window.history.back()">뒤로 가기</button>`;
                return;
            }

            let backButtonTargetHash = '#main';
            if (post.category === 'rooms' && post.room_slug) backButtonTargetHash = `#rooms-${post.room_slug}`;
            else if (post.category !== 'main') backButtonTargetHash = `#${post.category}`;

            const roomNameInTitle = await getRoomName(post.room_slug);

            mainContentArea.innerHTML = `
                <div class="post-detail">
                    <button class="back-button" onclick="window.location.hash = '${backButtonTargetHash}'">목록으로 돌아가기</button>
                    <h2>${roomNameInTitle}${escapeHTML(post.title)}</h2>
                    <p class="post-meta">
                        작성자: ${escapeHTML(post.date.substring(0, 19).replace('T', ' '))}
                        <span class="likes-dislikes">
                            <button class="like-button" data-post-id="${post.id}">좋아요 <span id="likesCount">${post.likes}</span></button>
                            <button class="dislike-button" data-post-id="${post.id}">싫어요 <span id="dislikesCount">${post.dislikes}</span></button>
                        </span>
                    </p>
                    <div class="post-content-detail"><div id="postContentDisplay"></div></div>
                    <div class="comments-section">
                        <h3>댓글</h3>
                        <form class="comment-form" data-post-id="${post.id}"><textarea placeholder="댓글을 남겨주세요" required></textarea><button type="submit">댓글 작성</button></form>
                        <ul class="comments-list">
                            ${comments.length === 0 ? '<li>아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</li>' : ''}
                            ${comments.map(comment => `<li><div class="comment-meta">${escapeHTML(comment.author)} | ${escapeHTML(comment.date.substring(0, 19).replace('T', ' '))}</div><span>${escapeHTML(comment.comment_text)}</span></li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;

            const postContentDisplay = document.getElementById('postContentDisplay');
            if (postContentDisplay && typeof DOMPurify !== 'undefined') {
                 postContentDisplay.innerHTML = DOMPurify.sanitize(post.content, { USE_PROFILES: { html: true }, ADD_TAGS: ['img', 'video', 'audio', 'iframe'], ADD_ATTR: ['allowfullscreen', 'autoplay', 'controls', 'src', 'alt', 'width', 'height', 'style'] });
            } else if (postContentDisplay) {
                console.warn('DOMPurify not loaded. Displaying raw HTML content (XSS risk).');
                postContentDisplay.innerHTML = post.content;
            }

            document.querySelector('.like-button')?.addEventListener('click', handleLikeDislike);
            document.querySelector('.dislike-button')?.addEventListener('click', handleLikeDislike);
            document.querySelector('.comment-form')?.addEventListener('submit', handleSubmitComment);
        } else {
            mainContentArea.innerHTML = `<p class="error-message">게시물 상세 정보를 불러오는데 실패했습니다: ${result.error || '알 수 없는 오류'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching post detail:', error);
        mainContentArea.innerHTML = `<p class="error-message">서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.<br>오류 상세: ${error.message}</p>`;
    }
}

async function handleSubmitComment(event) {
    event.preventDefault();
    const form = event.target;
    const postId = form.dataset.postId;
    const textarea = form.querySelector('textarea');
    const comment_text = textarea.value.trim();

    if (!comment_text) { alert('댓글 내용을 입력해주세요.'); return; }

    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment_text }) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || '알 수 없는 서버 오류'}`); }
        const result = await response.json();

        if (result.message === 'success') {
            const commentsList = form.nextElementSibling;
            const newComment = document.createElement('li');
            newComment.innerHTML = `<div class="comment-meta">익명 | ${escapeHTML(result.data.date.substring(0, 19).replace('T', ' '))}</div><span>${escapeHTML(result.data.comment_text)}</span>`;
            commentsList.querySelector('li:first-child')?.textContent.includes('아직 댓글이 없습니다.') && commentsList.removeChild(commentsList.querySelector('li:first-child'));
            commentsList.appendChild(newComment);
            textarea.value = '';
        } else { alert('댓글 작성에 실패했습니다: ' + (result.error || '알 수 없는 오류')); }
    } catch (error) {
        console.error('Error submitting comment:', error);
        alert(`서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.\n오류 상세: ${error.message}`);
    }
}

async function handleLikeDislike(event) {
    const button = event.target.closest('button');
    const postId = button.dataset.postId;
    const action = button.classList.contains('like-button') ? 'like' : 'dislike';

    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || '알 수 없는 서버 오류'}`); }
        const result = await response.json();
        if (result.message === 'success') {
            if (action === 'like') document.getElementById('likesCount').textContent = result.data.likes;
            else document.getElementById('dislikesCount').textContent = result.data.dislikes;
        } else { alert('오류 발생: ' + (result.error || '알 수 없는 오류')); }
    } catch (error) {
        console.error(`Error ${action}ing post:`, error);
        alert(`서버와 통신 중 오류가 발생했습니다.\n오류 상세: ${error.message}`);
    }
}


// --- 방 목록 관련 함수 ---

async function renderRoomsList() {
    mainContentArea.innerHTML = `<h2>여러 방 들</h2><p style="text-align: center; color: #777;">방 목록을 불러오는 중입니다...</p>`;
    try {
        const rooms = await fetchRooms();
        let roomsListHtml = `<h2>여러 방 들<button class="create-room-button">새 방 만들기</button></h2><div class="room-list">`;
        if (rooms.length === 0) roomsListHtml += '<p class="no-posts">개설된 방이 아직 없습니다. 새 방을 만들어보세요!</p>';
        else {
            rooms.forEach(room => {
                roomsListHtml += `<div class="room-card" data-room-slug="${escapeHTML(room.slug)}"><h3>${escapeHTML(room.name)}</h3><p>${escapeHTML(room.description)}</p></div>`;
            });
        }
        roomsListHtml += `</div>`;
        mainContentArea.innerHTML = roomsListHtml;

        document.querySelector('.create-room-button')?.addEventListener('click', () => createRoomModal.style.display = 'block');
        
        if (createRoomModal && closeButton) {
            closeButton.addEventListener('click', () => { createRoomModal.style.display = 'none'; createRoomForm.reset(); });
            window.addEventListener('click', (event) => { if (event.target === createRoomModal) { createRoomModal.style.display = 'none'; createRoomForm.reset(); } });
        }
        document.querySelector('#createRoomForm')?.addEventListener('submit', handleCreateRoomFormSubmit);

        attachRoomCardEventListeners(); // 방 카드 이벤트 연결
    } catch (error) {
        console.error('Error rendering rooms list:', error);
        mainContentArea.innerHTML = `<p class="error-message">서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.<br>오류 상세: ${error.message}</p>`;
    }
}

function attachRoomCardEventListeners() {
    document.querySelectorAll('.room-card').forEach(card => {
        card.removeEventListener('click', handleRoomCardClick);
        card.addEventListener('click', handleRoomCardClick);
    });
}

function handleRoomCardClick(event) {
    const roomSlug = event.currentTarget.closest('.room-card')?.dataset.roomSlug;
    if (roomSlug) window.location.hash = `#rooms-${roomSlug}`;
}

async function handleCreateRoomFormSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('roomName').value.trim();
    const description = document.getElementById('roomDescription').value.trim();

    if (!name) { alert('방 이름을 입력해주세요.'); return; }

    try {
        const response = await fetch(`${API_BASE_URL}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`방 생성 실패: ${errorData.error || '알 수 없는 서버 오류'}`); }
        const result = await response.json();
        if (result.message === 'success') {
            alert(`'${escapeHTML(result.data.name)}' 방이 성공적으로 생성되었습니다!`);
            createRoomModal.style.display = 'none';
            createRoomForm.reset();
            cachedRooms = [];
            renderRoomsList();
        } else { alert('방 생성 실패: ' + (result.error || '알 수 없는 오류')); }
    } catch (error) {
        console.error('Error creating room:', error);
        alert(`방 생성 중 오류 발생.\n오류 상세: ${error.message}`);
    }
}


// --- 검색/최신글 관련 함수 ---

async function renderSearchResults(query) {
    mainContentArea.innerHTML = `<h2>'${escapeHTML(query)}' 검색 결과</h2><p style="text-align: center; color: #777;">검색 결과를 불러오는 중입니다...</p>`;
    try {
        const response = await fetch(`${API_BASE_URL}/search/posts?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.message === 'success') {
            const posts = result.data;
            let searchResultsHtml = `<h2>'${escapeHTML(query)}' 검색 결과</h2><ul class="post-list" id="postList">`;
            if (posts.length === 0) searchResultsHtml += `<p class="no-posts">'${escapeHTML(query)}'에 대한 검색 결과가 없습니다.</p>`;
            else {
                for (const post of posts) {
                    const roomName = await getRoomName(post.room_slug);
                    searchResultsHtml += `<li data-post-id="${post.id}"><div class="post-header"><div class="title">${roomName}${escapeHTML(post.title)}</div><div class="meta">${escapeHTML(post.author)} | ${escapeHTML(post.date.substring(0, 10))} | ❤️ ${post.likes}</div></div></li>`;
                }
            }
            searchResultsHtml += `</ul>`;
            mainContentArea.innerHTML = searchResultsHtml;
            attachPostListEventListeners(); // 검색 결과에도 이벤트 연결
        } else { mainContentArea.innerHTML = `<p class="error-message">검색 결과를 불러오는데 실패했습니다: ${result.error || '알 수 없는 오류'}</p>`; }
    } catch (error) {
        console.error('Error fetching search results:', error);
        mainContentArea.innerHTML = `<p class="error-message">서버와 통신 중 오류 발생. 잠시 후 다시 시도해주세요.<br>오류 상세: ${error.message}</p>`;
    }
}

async function renderLatestPosts() {
    const latestPostsSection = document.getElementById('latestPostsSection');
    if (!latestPostsSection) return;

    const latestPostsList = document.getElementById('latestPostsList');
    if (latestPostsList) latestPostsList.innerHTML = `<li><p style="text-align: center; color: #777;">최신 글을 불러오는 중입니다...</p></li>`;

    try {
        const response = await fetch(`${API_BASE_URL}/latest_posts`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.message === 'success') {
            const posts = result.data;
            if (latestPostsList) {
                if (posts.length === 0) latestPostsList.innerHTML = `<li><p class="no-posts">아직 작성된 글이 없습니다.</p></li>`;
                else {
                    latestPostsList.innerHTML = '';
                    for (const post of posts) {
                        const roomName = await getRoomName(post.room_slug);
                        const li = document.createElement('li');
                        li.dataset.postId = post.id;
                        li.innerHTML = `<div class="post-header"><div class="title">${roomName}${escapeHTML(post.title)}</div><div class="meta">${escapeHTML(post.author)} | ${escapeHTML(post.date.substring(0, 10))}</div></div>`;
                        latestPostsList.appendChild(li);
                    }
                    latestPostsList.querySelectorAll('li').forEach(item => item.addEventListener('click', handlePostListClick));
                }
            }
        } else { if (latestPostsList) latestPostsList.innerHTML = `<li><p class="error-message">최신 글 불러오기 실패: ${result.error || '알 수 없는 오류'}</p></li>`; }
    } catch (error) {
        console.error('Error fetching latest posts:', error);
        if (latestPostsList) latestPostsList.innerHTML = `<li><p class="error-message">서버와 통신 중 오류 발생.</p></li>`;
    }
}


// --- 페이지 로드 및 이벤트 리스너 설정 ---

/**
 * 페이지 콘텐츠를 로드하는 메인 함수 (URL 해시 기반)
 */
async function loadContent(path) {
    navLinks.forEach(link => link.classList.remove('active'));

    let currentCategory = 'main';
    let navHref = 'index.html';
    let roomSlug = null;
    let sortBy = 'date';
    let searchQuery = null;

    const parts = path.split('?');
    const hashPart = parts[0];
    if (parts.length > 1) {
        const queryParams = new URLSearchParams(parts[1]);
        sortBy = queryParams.get('sortBy') || 'date';
        searchQuery = queryParams.get('q');
    }

    if (hashPart.startsWith('post-')) {
        await renderPostDetail(parseInt(hashPart.split('-')[1]));
    } else if (hashPart.startsWith('rooms-')) {
        currentCategory = 'rooms';
        roomSlug = hashPart.substring('rooms-'.length);
        navHref = 'rooms.html';
        await renderPostList(currentCategory, roomSlug, sortBy);
    } else if (hashPart === 'search') {
        currentCategory = 'search';
        await renderSearchResults(searchQuery);
    } else {
        switch (hashPart) {
            case 'main': currentCategory = 'main'; navHref = 'index.html'; break;
            case 'freeboard': currentCategory = 'freeboard'; navHref = 'freeboard.html'; break;
            case 'rooms': currentCategory = 'rooms'; navHref = 'rooms.html'; await renderRoomsList(); break;
            case 'notice': currentCategory = 'notice'; navHref = 'notice.html'; break;
            default: currentCategory = 'main'; navHref = 'index.html'; break;
        }
        if (!['rooms', 'search'].includes(hashPart) && !hashPart.startsWith('rooms-')) {
            await renderPostList(currentCategory, null, sortBy);
        }
    }
    document.querySelector(`a[href="${navHref}"]`)?.classList.add('active');

    if (currentCategory === 'freeboard' && document.getElementById('latestPostsSection')) {
        renderLatestPosts(); // 최신 글 5개 로드
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const currentFileName = window.location.pathname.split('/').pop();
    let initialCategory = 'main';
    if (currentFileName === 'freeboard.html') initialCategory = 'freeboard';
    else if (currentFileName === 'rooms.html') initialCategory = 'rooms';
    else if (currentFileName === 'notice.html') initialCategory = 'notice';
    else if (currentFileName === 'search.html') {
        const query = new URLSearchParams(window.location.search).get('q');
        if (query) loadContent(`search?q=${query}`);
        else mainContentArea.innerHTML = `<p class="error-message">검색어가 없습니다.</p>`;
        return;
    } else if (currentFileName === 'write.html') {
        return;
    }

    loadContent(window.location.hash.substring(1) || initialCategory);

    window.addEventListener('hashchange', () => loadContent(window.location.hash.substring(1) || initialCategory));

    if (globalSearchButton) {
        globalSearchButton.addEventListener('click', () => {
            const query = globalSearchInput.value.trim();
            if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            else alert('검색어를 입력해주세요.');
        });
    }
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') globalSearchButton.click();
        });
    }
});

navLinks.forEach(link => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        const boardKey = event.target.href.split('/').pop().replace('.html', '');
        if (['write', 'search'].includes(boardKey)) window.location.href = `${boardKey}.html`;
        else if (boardKey === 'index') window.location.hash = '#main';
        else window.location.hash = `#${boardKey}?sortBy=date`;
    });
});
