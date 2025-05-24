// frontend/script.js

// 백엔드 API의 기본 URL
const API_BASE_URL = 'http://localhost:3000/api';

// DOM 요소 캐싱
const mainContentArea = document.getElementById('mainContentArea');
const navLinks = document.querySelectorAll('nav ul li a');
const globalSearchInput = document.getElementById('globalSearchInput');
const globalSearchButton = document.getElementById('globalSearchButton');

// Rooms 페이지 관련 DOM 요소 (Rooms 페이지에서만 존재)
const createRoomModal = document.getElementById('createRoomModal');
const closeButton = document.querySelector('.modal .close-button');
const createRoomForm = document.getElementById('createRoomForm');

// rooms 데이터를 캐싱하여 불필요한 API 호출 줄이기
let cachedRooms = [];

// 현재 게시물 정렬 기준 (기본값: 최신순)
let currentSortBy = 'date'; // 'date' 또는 'likes'

// --- 함수 정의 ---

/**
 * HTML 특수 문자를 안전하게 이스케이프 처리 (순수 텍스트 표시용)
 * HTML 내용 자체를 표시할 때는 사용하지 않음
 * @param {string} text - 처리할 원본 텍스트
 * @returns {string} 이스케이프 처리된 텍스트
 */
function escapeHTML(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    if (text === null || typeof text === 'undefined') {
        return '';
    }
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * 방 이름 가져오기
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
 * 게시물 목록을 렌더링하는 함수 (카테고리별 필터링, 정렬, room_slug 필터링 추가)
 * @param {string} category - 조회할 게시물 카테고리 ('main', 'freeboard', 'rooms', 'notice')
 * @param {string} [roomSlug=null] - rooms 카테고리일 경우 특정 방의 slug
 * @param {string} [sortBy='date'] - 정렬 기준 ('date' 또는 'likes')
 */
async function renderPostList(category = 'main', roomSlug = null, sortBy = 'date') {
    currentSortBy = sortBy; // 현재 정렬 기준 업데이트
    try {
        mainContentArea.innerHTML = `
            <h2>${await getCategoryTitle(category, roomSlug)}</h2>
            <p style="text-align: center; color: #777;">게시물을 불러오는 중입니다...</p>
        `;
        
        let url = `${API_BASE_URL}/posts?category=${category}&sortBy=${sortBy}`;
        if (roomSlug) {
            url += `&roomSlug=${roomSlug}`;
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();

        if (result.message === 'success') {
            const posts = result.data;
            let pageTitle = await getCategoryTitle(category, roomSlug);
            
            let writeButtonHtml = '';
            // 메인, 자유 게시판, 특정 방에서만 글쓰기 버튼 표시
            if (category === 'main') {
                writeButtonHtml = `<button class="write-button" onclick="location.href='write.html?category=main'">새 글 쓰기</button>`;
            } else if (category === 'freeboard') {
                writeButtonHtml = `<button class="write-button" onclick="location.href='write.html?category=freeboard'">새 글 쓰기</button>`;
            } else if (category === 'rooms' && roomSlug) {
                // 특정 방 내부에서 새 글 쓰기 버튼
                writeButtonHtml = `<button class="write-button" onclick="location.href='write.html?category=rooms&roomSlug=${encodeURIComponent(roomSlug)}'">이 방에 글 쓰기</button>`;
            } else if (category === 'notice') {
                 // 공지사항은 관리자만 쓸 수 있도록 버튼 제거하거나 기능 제한 (여기서는 제거)
                writeButtonHtml = '';
            }

            let backButtonHtml = '';
            if (roomSlug) { // 특정 방 게시물 목록에서 방 목록으로 돌아가는 버튼
                backButtonHtml = `<button class="back-button" onclick="window.location.hash = '#rooms'">방 목록으로</button>`;
            }

            // 정렬 필터 버튼
            let sortButtonsHtml = '';
            if (category !== 'main' && category !== 'notice' && category !== 'search') { // 메인, 공지사항, 검색에서는 정렬 버튼 제외
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
            if (posts.length === 0) {
                postListHtml += '<p class="no-posts">아직 작성된 게시물이 없습니다. 첫 글을 작성해보세요!</p>';
            } else {
                for (const post of posts) {
                    const roomName = await getRoomName(post.room_slug); // 비동기 함수 호출 대기
                    postListHtml += `
                        <li data-post-id="${post.id}">
                            <div class="post-header">
                                <div class="title">${roomName}${escapeHTML(post.title)}</div>
                                <div class="meta">${escapeHTML(post.author)} | ${escapeHTML(post.date.substring(0, 10))} | ❤️ ${post.likes}</div>
                            </div>
                        </li>
                    `;
                }
            }
            postListHtml += `</ul>`;
            mainContentArea.innerHTML = postListHtml;

            // 게시물 목록 클릭 이벤트 리스너 다시 연결
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
    if (category === 'rooms' && roomSlug) {
        window.location.hash = `#rooms-${roomSlug}?sortBy=${sortBy}`;
    } else {
        window.location.hash = `#${category}?sortBy=${sortBy}`;
    }
}


/**
 * 특정 게시물의 상세 내용을 렌더링하는 함수
 * @param {number} postId - 조회할 게시물 ID
 */
async function renderPostDetail(postId) {
    try {
        mainContentArea.innerHTML = `
            <h2>게시물 상세</h2>
            <p style="text-align: center; color: #777;">게시물 상세 정보를 불러오는 중입니다...</p>
        `;

        const response = await fetch(`${API_BASE_URL}/posts/${postId}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const result = await response.json();

        if (result.message === 'success') {
            const { post, comments } = result.data;
            if (!post) {
                mainContentArea.innerHTML = `
                    <h2>게시물을 찾을 수 없습니다.</h2>
                    <button class="back-button" onclick="window.history.back()">뒤로 가기</button>
                `;
                return;
            }

            let backButtonTargetHash = '#main'; // 기본값
            if (post.category === 'rooms' && post.room_slug) {
                backButtonTargetHash = `#rooms-${post.room_slug}`;
            } else if (post.category !== 'main') {
                backButtonTargetHash = `#${post.category}`;
            }

            const roomNameInTitle = await getRoomName(post.room_slug);

            let detailHtml = `
                <div class="post-detail">
                    <button class="back-button" onclick="window.location.hash = '${backButtonTargetHash}'">목록으로 돌아가기</button>
                    <h2>${roomNameInTitle}${escapeHTML(post.title)}</h2>
                    <p class="post-meta">
                        작성자: ${escapeHTML(post.author)} | ${escapeHTML(post.date.substring(0, 19).replace('T', ' '))}
                        <span class="likes-dislikes">
                            <button class="like-button" data-post-id="${post.id}">좋아요 <span id="likesCount">${post.likes}</span></button>
                            <button class="dislike-button" data-post-id="${post.id}">싫어요 <span id="dislikesCount">${post.dislikes}</span></button>
                        </span>
                    </p>
                    <div class="post-content-detail">
                        <div id="postContentDisplay"></div>
                    </div>

                    <div class="comments-section">
                        <h3>댓글</h3>
                        <form class="comment-form" data-post-id="${post.id}">
                            <textarea placeholder="댓글을 남겨주세요" required></textarea>
                            <button type="submit">댓글 작성</button>
                        </form>
                        <ul class="comments-list">
                            ${comments.length === 0 ? '<li>아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</li>' : ''}
                            ${comments.map(comment => `
                                <li>
                                    <div class="comment-meta">${escapeHTML(comment.author)} | ${escapeHTML(comment.date.substring(0, 19).replace('T', ' '))}</div>
                                    <span>${escapeHTML(comment.comment_text)}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
            mainContentArea.innerHTML = detailHtml;

            // XSS 방지를 위해 DOMPurify를 사용하여 HTML 삽입
            const postContentDisplay = document.getElementById('postContentDisplay');
            if (postContentDisplay && typeof DOMPurify !== 'undefined') {
                 // DOMPurify.sanitize 함수는 HTML 문자열을 안전하게 처리하여 반환
                postContentDisplay.innerHTML = DOMPurify.sanitize(post.content, {
                    USE_PROFILES: { html: true }, // 기본 HTML 프로필 사용
                    ADD_TAGS: ['img', 'video', 'audio', 'iframe'], // 필요하다면 추가 허용 태그
                    ADD_ATTR: ['allowfullscreen', 'autoplay', 'controls', 'src', 'alt', 'width', 'height', 'style'] // 추가 허용 속성
                });
            } else if (postContentDisplay) {
                // DOMPurify가 로드되지 않았다면 경고 후 직접 삽입 (위험)
                console.warn('DOMPurify not loaded. Displaying raw HTML content (XSS risk).');
                postContentDisplay.innerHTML = post.content;
            }


            const likeButton = document.querySelector('.like-button');
            if (likeButton) likeButton.addEventListener('click', handleLikeDislike);
            const dislikeButton = document.querySelector('.dislike-button');
            if (dislikeButton) dislikeButton.addEventListener('click', handleLikeDislike);

            const commentForm = document.querySelector('.comment-form');
            if (commentForm) commentForm.addEventListener('submit', handleSubmitComment);

        } else {
            mainContentArea.innerHTML = `<p class="error-message">게시물 상세 정보를 불러오는데 실패했습니다: ${result.error || '알 수 없는 오류'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching post detail:', error);
        mainContentArea.innerHTML = `<p class="error-message">서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.<br>오류 상세: ${error.message}</p>`;
    }
}

// rooms 데이터를 캐싱하여 불필요한 API 호출 줄이기
async function fetchRooms() {
    if (cachedRooms.length > 0) {
        return cachedRooms;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/rooms`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
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
 * 카테고리 문자열에 따른 페이지 제목 반환
 * @param {string} category - 카테고리 문자열
 * @param {string} [roomSlug=null] - roomSlug (있는 경우)
 * @returns {string} 페이지 제목
 */
async function getCategoryTitle(category, roomSlug = null) {
    if (roomSlug) {
        try {
            const rooms = await fetchRooms();
            const room = rooms.find(r => r.slug === roomSlug);
            return room ? `${escapeHTML(room.name)} 게시물` : `${escapeHTML(roomSlug)} 게시물`;
        } catch (e) {
            console.error('Error getting room name:', e);
            return `${escapeHTML(roomSlug)} 게시물`;
        }
    }
    if (category === 'main') return '최신 게시물';
    if (category === 'freeboard') return '자유 게시판';
    if (category === 'rooms') return '여러 방 들'; // 방 목록 페이지 제목
    if (category === 'notice') return '공지사항';
    if (category === 'search') return '검색 결과'; // 검색 결과 페이지 제목
    return '게시판';
}

/**
 * 여러 방 목록을 렌더링하는 함수 (방 만들기 버튼 추가)
 */
async function renderRoomsList() {
    try {
        mainContentArea.innerHTML = `
            <h2>여러 방 들</h2>
            <button class="create-room-button">새 방 만들기</button>
            <p style="text-align: center; color: #777;">방 목록을 불러오는 중입니다...</p>
        `;

        const rooms = await fetchRooms(); // 캐시된 데이터 또는 API 호출

        if (rooms) { // fetchRooms가 성공적으로 데이터를 반환했을 경우
            let roomsListHtml = `
                <h2>
                    여러 방 들
                    <button class="create-room-button">새 방 만들기</button>
                </h2>
                <div class="room-list">
            `;
            if (rooms.length === 0) {
                roomsListHtml += '<p class="no-posts">개설된 방이 아직 없습니다. 새 방을 만들어보세요!</p>';
            } else {
                rooms.forEach(room => {
                    roomsListHtml += `
                        <div class="room-card" data-room-slug="${escapeHTML(room.slug)}">
                            <h3>${escapeHTML(room.name)}</h3>
                            <p>${escapeHTML(room.description)}</p>
                        </div>
                    `;
                });
            }
            roomsListHtml += `</div>`;
            mainContentArea.innerHTML = roomsListHtml;

            // 방 카드 클릭 이벤트 리스너 연결
            attachRoomCardEventListeners();

            // 방 만들기 버튼 클릭 이벤트 리스너
            const createRoomButton = document.querySelector('.create-room-button');
            if (createRoomButton) {
                createRoomButton.addEventListener('click', () => {
                    if (createRoomModal) {
                        createRoomModal.style.display = 'block';
                    }
                });
            }

        } else { // fetchRooms에서 오류가 발생했거나 데이터가 없는 경우
            mainContentArea.innerHTML = `<p class="error-message">방 목록을 불러오는데 실패했습니다: 데이터를 가져올 수 없습니다.</p>`;
        }
    } catch (error) {
        console.error('Error rendering rooms list:', error);
        mainContentArea.innerHTML = `<p class="error-message">서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.<br>오류 상세: ${error.message}</p>`;
    }
}

/**
 * 페이지 콘텐츠를 로드하는 메인 함수 (URL 해시 기반)
 * @param {string} path - URL 해시 (예: 'main', 'freeboard', 'rooms', 'rooms-daily-talk', 'notice', 'post-123', 'search?q=검색어')
 */
async function loadContent(path) {
    navLinks.forEach(link => link.classList.remove('active'));

    let currentCategory = 'main';
    let navHref = 'index.html';
    let roomSlug = null;
    let sortBy = 'date';
    let searchQuery = null;

    // URL 쿼리 파라미터 파싱
    const parts = path.split('?');
    const hashPart = parts[0];
    if (parts.length > 1) {
        const queryParams = new URLSearchParams(parts[1]);
        sortBy = queryParams.get('sortBy') || 'date';
        searchQuery = queryParams.get('q');
    }

    if (hashPart.startsWith('post-')) {
        const postId = parseInt(hashPart.split('-')[1]);
        if (!isNaN(postId)) {
            renderPostDetail(postId);
            return;
        }
    } else if (hashPart.startsWith('rooms-')) { // 특정 방 게시물 목록
        currentCategory = 'rooms';
        roomSlug = hashPart.substring('rooms-'.length);
        navHref = 'rooms.html'; // 내비게이션은 '여러 방 들'로 활성화
        await renderPostList(currentCategory, roomSlug, sortBy);
    } else if (hashPart === 'search') { // 검색 결과 페이지
        currentCategory = 'search'; // 'search' 카테고리로 간주
        await renderSearchResults(searchQuery);
        // 검색 결과 페이지는 특정 nav link를 활성화하지 않음
        return; 
    }
    else { // 일반 게시판 또는 방 목록
        switch (hashPart) {
            case 'main':
                currentCategory = 'main';
                navHref = 'index.html';
                break;
            case 'freeboard':
                currentCategory = 'freeboard';
                navHref = 'freeboard.html';
                // 자유 게시판일 경우 최신 글 5개 로드
                if (document.getElementById('latestPostsSection')) {
                    await renderLatestPosts();
                }
                break;
            case 'rooms': // '여러 방 들' (방 목록 자체)
                currentCategory = 'rooms';
                navHref = 'rooms.html';
                await renderRoomsList(); // 방 목록 렌더링 함수 호출
                break;
            case 'notice':
                currentCategory = 'notice';
                navHref = 'notice.html';
                break;
            default:
                currentCategory = 'main';
                navHref = 'index.html';
                break;
        }
        // 'rooms'는 renderRoomsList()에서 처리했으므로 중복 호출 방지
        if (hashPart !== 'rooms' && !hashPart.startsWith('rooms-') && hashPart !== 'search') {
             await renderPostList(currentCategory, null, sortBy);
        }
    }

    const activeLink = document.querySelector(`a[href="${navHref}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}


/**
 * 방 카드에 클릭 이벤트 리스너를 연결하는 함수
 */
function attachRoomCardEventListeners() {
    const roomCards = document.querySelectorAll('.room-card');
    roomCards.forEach(card => {
        card.removeEventListener('click', handleRoomCardClick);
        card.addEventListener('click', handleRoomCardClick);
    });
}

/**
 * 방 카드 클릭 시 해당 방의 게시물 목록으로 이동하는 핸들러
 * @param {Event} event - 클릭 이벤트 객체
 */
function handleRoomCardClick(event) {
    const card = event.currentTarget.closest('.room-card');
    const roomSlug = card ? card.dataset.roomSlug : null;
    if (roomSlug) {
        window.location.hash = `#rooms-${roomSlug}`;
    }
}


/**
 * 게시물 목록에 클릭 이벤트 리스너를 연결하는 함수
 */
function attachPostListEventListeners() {
    const postListElements = document.querySelectorAll('#postList li');
    postListElements.forEach(item => {
        item.removeEventListener('click', handlePostListClick);
        item.addEventListener('click', handlePostListClick);
    });
}

/**
 * 게시물 목록에서 게시물 클릭 시 상세 페이지로 이동하는 핸들러
 * @param {Event} event - 클릭 이벤트 객체
 */
function handlePostListClick(event) {
    const listItem = event.currentTarget.closest('li');
    const postId = listItem ? parseInt(listItem.dataset.postId) : null;
    if (postId) {
        window.location.hash = `#post-${postId}`;
    }
}

/**
 * 댓글 제출 핸들러
 */
async function handleSubmitComment(event) {
    event.preventDefault();
    const form = event.target;
    const postId = form.dataset.postId;
    const textarea = form.querySelector('textarea');
    const comment_text = textarea.value.trim();

    if (!comment_text) {
        alert('댓글 내용을 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ comment_text })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || '알 수 없는 서버 오류'}`);
        }

        const result = await response.json();

        if (result.message === 'success') {
            const commentsList = form.nextElementSibling;
            const newComment = document.createElement('li');
            newComment.innerHTML = `
                <div class="comment-meta">익명 | ${escapeHTML(result.data.date.substring(0, 19).replace('T', ' '))}</div>
                <span>${escapeHTML(result.data.comment_text)}</span>
            `;
            const noCommentsMessage = commentsList.querySelector('li:first-child');
            if (noCommentsMessage && noCommentsMessage.textContent.includes('아직 댓글이 없습니다.')) {
                commentsList.removeChild(noCommentsMessage);
            }
            commentsList.appendChild(newComment);
            textarea.value = '';
        } else {
            alert('댓글 작성에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('Error submitting comment:', error);
        alert(`서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.\n오류 상세: ${error.message}`);
    }
}

/**
 * 좋아요/싫어요 버튼 클릭 핸들러
 */
async function handleLikeDislike(event) {
    const button = event.target.closest('button');
    const postId = button.dataset.postId;
    const action = button.classList.contains('like-button') ? 'like' : 'dislike';

    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || '알 수 없는 서버 오류'}`);
        }

        const result = await response.json();

        if (result.message === 'success') {
            if (action === 'like') {
                document.getElementById('likesCount').textContent = result.data.likes;
            } else {
                document.getElementById('dislikesCount').textContent = result.data.dislikes;
            }
        } else {
            alert('오류 발생: ' + (result.error || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error(`Error ${action}ing post:`, error);
        alert(`서버와 통신 중 오류가 발생했습니다.\n오류 상세: ${error.message}`);
    }
}


/**
 * 전역 검색 결과 렌더링 함수
 * @param {string} query - 검색어
 */
async function renderSearchResults(query) {
    try {
        mainContentArea.innerHTML = `
            <h2>'${escapeHTML(query)}' 검색 결과</h2>
            <p style="text-align: center; color: #777;">검색 결과를 불러오는 중입니다...</p>
        `;

        const response = await fetch(`${API_BASE_URL}/search/posts?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const result = await response.json();

        if (result.message === 'success') {
            const posts = result.data;
            let searchResultsHtml = `
                <h2>'${escapeHTML(query)}' 검색 결과</h2>
                <ul class="post-list" id="postList">
            `;
            if (posts.length === 0) {
                searchResultsHtml += `<p class="no-posts">'${escapeHTML(query)}'에 대한 검색 결과가 없습니다.</p>`;
            } else {
                for (const post of posts) {
                    const roomName = await getRoomName(post.room_slug);
                    searchResultsHtml += `
                        <li data-post-id="${post.id}">
                            <div class="post-header">
                                <div class="title">${roomName}${escapeHTML(post.title)}</div>
                                <div class="meta">${escapeHTML(post.author)} | ${escapeHTML(post.date.substring(0, 10))} | ❤️ ${post.likes}</div>
                            </div>
                        </li>
                    `;
                }
            }
            searchResultsHtml += `</ul>`;
            mainContentArea.innerHTML = searchResultsHtml;
            attachPostListEventListeners();
        } else {
            mainContentArea.innerHTML = `<p class="error-message">검색 결과를 불러오는데 실패했습니다: ${result.error || '알 수 없는 오류'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching search results:', error);
        mainContentArea.innerHTML = `<p class="error-message">서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.<br>오류 상세: ${error.message}</p>`;
    }
}

/**
 * 최신 게시물 5개 렌더링 함수 (자유 게시판 전용)
 */
async function renderLatestPosts() {
    const latestPostsList = document.getElementById('latestPostsList');
    if (!latestPostsList) return; // 자유 게시판이 아니면 실행하지 않음

    latestPostsList.innerHTML = `<li><p style="text-align: center; color: #777;">최신 글을 불러오는 중입니다...</p></li>`;

    try {
        const response = await fetch(`${API_BASE_URL}/latest_posts`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const result = await response.json();

        if (result.message === 'success') {
            const posts = result.data;
            if (posts.length === 0) {
                latestPostsList.innerHTML = `<li><p class="no-posts">아직 작성된 글이 없습니다.</p></li>`;
            } else {
                latestPostsList.innerHTML = ''; // 기존 "불러오는 중..." 메시지 삭제
                for (const post of posts) {
                    const roomName = await getRoomName(post.room_slug);
                    const li = document.createElement('li');
                    li.dataset.postId = post.id;
                    li.innerHTML = `
                        <div class="post-header">
                            <div class="title">${roomName}${escapeHTML(post.title)}</div>
                            <div class="meta">${escapeHTML(post.author)} | ${escapeHTML(post.date.substring(0, 10))}</div>
                        </div>
                    `;
                    latestPostsList.appendChild(li);
                }
                // 최신 글 목록에도 클릭 이벤트 리스너 연결
                latestPostsList.querySelectorAll('li').forEach(item => {
                    item.addEventListener('click', handlePostListClick);
                });
            }
        } else {
            latestPostsList.innerHTML = `<li><p class="error-message">최신 글을 불러오는데 실패했습니다: ${result.error || '알 수 없는 오류'}</p></li>`;
        }
    } catch (error) {
        console.error('Error fetching latest posts:', error);
        latestPostsList.innerHTML = `<li><p class="error-message">서버와 통신 중 오류가 발생했습니다.</p></li>`;
    }
}


/**
 * 새 방 생성 요청 처리
 */
async function handleCreateRoomFormSubmit(event) {
    event.preventDefault(); // 폼 기본 제출 동작 방지

    const roomNameInput = document.getElementById('roomName');
    const roomDescriptionInput = document.getElementById('roomDescription');

    const name = roomNameInput.value.trim();
    const description = roomDescriptionInput.value.trim();

    if (!name) {
        alert('방 이름을 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = `방 생성에 실패했습니다: ${errorData.error || '알 수 없는 서버 오류'}`;
            if (response.status === 409) {
                errorMessage = '이미 동일한 이름의 방이 존재합니다. 다른 이름을 사용해주세요.';
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        if (result.message === 'success') {
            alert(`'${escapeHTML(result.data.name)}' 방이 성공적으로 생성되었습니다!`);
            createRoomModal.style.display = 'none'; // 모달 닫기
            createRoomForm.reset(); // 폼 초기화
            cachedRooms = []; // 캐시된 방 목록 초기화하여 새로고침 시 다시 불러오도록 함
            renderRoomsList(); // 방 목록 다시 렌더링
        } else {
            alert('방 생성에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('Error creating room:', error);
        alert(`방 생성 중 오류가 발생했습니다.\n오류 상세: ${error.message}`);
    }
}


// --- 초기 로드 및 이벤트 리스너 설정 ---

document.addEventListener('DOMContentLoaded', () => {
    const currentFileName = window.location.pathname.split('/').pop();
    let initialCategory = 'main';

    if (currentFileName === 'freeboard.html') {
        initialCategory = 'freeboard';
    } else if (currentFileName === 'rooms.html') {
        initialCategory = 'rooms';
        // rooms.html 일 때 모달 관련 이벤트 리스너 설정
        if (createRoomModal) {
            closeButton.addEventListener('click', () => {
                createRoomModal.style.display = 'none';
            });
            window.addEventListener('click', (event) => {
                if (event.target === createRoomModal) {
                    createRoomModal.style.display = 'none';
                }
            });
        }
        if (createRoomForm) {
            createRoomForm.addEventListener('submit', handleCreateRoomFormSubmit);
        }
    } else if (currentFileName === 'notice.html') {
        initialCategory = 'notice';
    } else if (currentFileName === 'search.html') {
        // search.html 페이지에서는 script.js가 직접 콘텐츠를 로드하지 않고
        // URL 쿼리를 사용하여 검색 결과를 로드합니다.
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
            loadContent(`search?q=${query}`); // loadContent 함수가 search 쿼리 처리
        } else {
            mainContentArea.innerHTML = `<p class="error-message">검색어가 없습니다.</p>`;
        }
        return; // search.html에서는 이후 DOMContentLoaded 로직을 실행하지 않음
    } else if (currentFileName === 'write.html') {
        // write.html 페이지에서는 script.js가 직접 콘텐츠를 로드하지 않음.
        // write.html 자체의 스크립트가 로드를 처리하므로 여기서 할 일 없음.
        return;
    }

    const initialHash = window.location.hash.substring(1);
    loadContent(initialHash || initialCategory);

    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.substring(1);
        loadContent(newHash || initialCategory);
    });

    // 전역 검색 버튼 이벤트 리스너
    if (globalSearchButton) {
        globalSearchButton.addEventListener('click', () => {
            const query = globalSearchInput.value.trim();
            if (query) {
                // search.html로 이동하면서 쿼리 파라미터 전달
                window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            } else {
                alert('검색어를 입력해주세요.');
            }
        });
    }

    // Enter 키로 검색 실행
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                globalSearchButton.click();
            }
        });
    }
});

// 내비게이션 링크 클릭 시 해시 변경
navLinks.forEach(link => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        const boardKey = event.target.href.split('/').pop().replace('.html', '');
        // write.html 또는 search.html로 이동할 때는 해시가 아닌 직접 페이지 로드
        if (boardKey === 'write') {
            window.location.href = 'write.html';
        } else if (boardKey === 'search') {
            window.location.href = 'search.html';
        } else if (boardKey === 'index') {
            window.location.hash = '#main';
        } else {
            // 다른 게시판으로 이동 시 정렬 기준 초기화 (최신순)
            window.location.hash = `#${boardKey}?sortBy=date`;
        }
    });
});
// frontend/script.js

// ... (기존 변수 선언 및 함수들) ...

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 이벤트 발생 - script.js 로드 시작'); // 1. script.js 로드 확인

    const currentFileName = window.location.pathname.split('/').pop();
    let initialCategory = 'main';

    if (currentFileName === 'freeboard.html') {
        initialCategory = 'freeboard';
    } else if (currentFileName === 'rooms.html') {
        initialCategory = 'rooms';
        console.log('현재 페이지는 rooms.html입니다.'); // 2. rooms.html 페이지 확인

        // rooms.html 일 때 모달 관련 이벤트 리스너 설정
        // 이 DOM 요소들이 제대로 찾아지는지 확인
        const createRoomModalElement = document.getElementById('createRoomModal');
        const closeButtonElement = createRoomModalElement ? createRoomModalElement.querySelector('.close-button') : null;
        const createRoomFormElement = document.getElementById('createRoomForm');

        if (createRoomModalElement) {
            console.log('createRoomModal 요소 찾음.'); // 3. 모달 요소 찾음 확인
            createRoomModalElement.style.display = 'none'; // 혹시 모를 기본 표시 방지

            closeButtonElement.addEventListener('click', () => { // closeButtonElement에 null 체크 추가 (안전성)
                createRoomModalElement.style.display = 'none';
                console.log('모달 닫기 버튼 클릭됨.');
            });
            window.addEventListener('click', (event) => {
                if (event.target === createRoomModalElement) {
                    createRoomModalElement.style.display = 'none';
                    console.log('모달 바깥 클릭됨.');
                }
            });
        } else {
            console.warn('경고: createRoomModal 요소를 찾을 수 없습니다.'); // 3.1. 모달 요소 못 찾음 경고
        }
        if (createRoomFormElement) {
            console.log('createRoomForm 요소 찾음.'); // 4. 폼 요소 찾음 확인
            createRoomFormElement.addEventListener('submit', handleCreateRoomFormSubmit);
        } else {
            console.warn('경고: createRoomForm 요소를 찾을 수 없습니다.'); // 4.1. 폼 요소 못 찾음 경고
        }
    }
    // ... (나머지 DOMContentLoaded 로직) ...

    // 전역 검색 버튼 이벤트 리스너 (이 부분도 잘 붙는지 확인)
    if (globalSearchButton) {
        console.log('글로벌 검색 버튼 찾음.');
        globalSearchButton.addEventListener('click', () => {
            console.log('글로벌 검색 버튼 클릭됨.');
            const query = globalSearchInput.value.trim();
            if (query) {
                window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            } else {
                alert('검색어를 입력해주세요.');
            }
        });
    } else {
        console.warn('경고: 글로벌 검색 버튼을 찾을 수 없습니다.');
    }

    // Enter 키로 검색 실행
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                console.log('엔터 키 입력됨.');
                globalSearchButton.click();
            }
        });
    }

}); // DOMContentLoaded 끝

// handleCreateRoomFormSubmit 함수 안에도 console.log 추가
async function handleCreateRoomFormSubmit(event) {
    event.preventDefault(); // 폼 기본 제출 동작 방지
    console.log('handleCreateRoomFormSubmit 함수 실행됨.'); // 5. 폼 제출 함수 실행 확인

    const roomNameInput = document.getElementById('roomName');
    const roomDescriptionInput = document.getElementById('roomDescription');

    const name = roomNameInput.value.trim();
    const description = roomDescriptionInput.value.trim();

    if (!name) {
        alert('방 이름을 입력해주세요.');
        return;
    }

    console.log('방 이름:', name, '방 설명:', description); // 6. 입력값 확인

    try {
        console.log('API 요청 시작: POST /api/rooms'); // 7. API 요청 시작 확인
        const response = await fetch(`${API_BASE_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });
        console.log('API 응답 수신:', response.status); // 8. API 응답 상태 코드 확인

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = `방 생성에 실패했습니다: ${errorData.error || '알 수 없는 서버 오류'}`;
            if (response.status === 409) {
                errorMessage = '이미 동일한 이름의 방이 존재합니다. 다른 이름을 사용해주세요.';
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('API 응답 결과:', result); // 9. API 응답 데이터 확인

        if (result.message === 'success') {
            alert(`'${escapeHTML(result.data.name)}' 방이 성공적으로 생성되었습니다!`);
            createRoomModal.style.display = 'none'; // 모달 닫기
            createRoomForm.reset(); // 폼 초기화
            cachedRooms = []; // 캐시된 방 목록 초기화하여 새로고침 시 다시 불러오도록 함
            renderRoomsList(); // 방 목록 다시 렌더링
        } else {
            alert('방 생성에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('방 생성 중 오류 발생:', error); // 10. try-catch 블록 내 오류
        alert(`방 생성 중 오류가 발생했습니다.\n오류 상세: ${error.message}`);
    }
}