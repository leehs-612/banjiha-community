// backend/server.js

// Node.js 기본 모듈 및 설치된 패키지 로드
const express = require('express');        // Express.js 웹 프레임워크
const sqlite3 = require('sqlite3').verbose(); // SQLite3 데이터베이스 드라이버
const cors = require('cors');              // CORS (교차 출처 리소스 공유) 미들웨어
const multer = require('multer');          // 파일 업로드 처리 미들웨어
const path = require('path');              // 파일 경로 처리 유틸리티
const fs = require('fs');                  // 파일 시스템 처리 유틸리티

// Express 애플리케이션 초기화
const app = express();
// PORT 환경 변수가 있으면 사용하고, 없으면 3000번 포트를 기본값으로 사용
const port = process.env.PORT || 3000;

// --- 미들웨어 설정 ---

// 1. JSON 형식의 요청 본문(request body)을 파싱하기 위한 미들웨어
app.use(express.json());

// 2. CORS (Cross-Origin Resource Sharing) 설정
// 다른 도메인/포트의 프론트엔드에서 백엔드로 요청을 보낼 수 있도록 허용합니다.
// 개발 단계에서만 사용하고, 실제 배포 시에는 더 엄격하게 설정하거나 Nginx 등에서 처리합니다.
// IMPORTANT: `YOUR_SERVER_IP_ADDRESS` 부분을 당신의 컴퓨터의 실제 로컬 IP 주소로 변경하세요!
// 예: `http://192.168.0.100:8080`
// 배포 환경에서는 실제 배포된 프론트엔드 URL과 백엔드 URL을 추가해야 합니다.
const allowedOrigins = [
    'http://localhost:8080',      // 로컬 개발 환경 (localhost)
    'http://127.0.0.1:8080',      // 로컬 개발 환경 (127.0.0.1)
    `http://YOUR_SERVER_IP_ADDRESS:8080` // <<<<<<<< 여기를 당신의 IP 주소로 변경하세요!
    // 배포 시 추가 (예시):
    // 'http://your-frontend-domain.com',
    // 'https://your-frontend-domain.com',
    // 'http://your-backend-ip-address:80', // Nginx를 통해 80포트로 접근 시
    // 'https://your-backend-ip-address:443' // Nginx를 통해 443포트로 접근 시
];

app.use(cors({
    origin: function (origin, callback) {
        // 요청 출처(origin)가 없거나 (예: Postman 요청), 허용된 출처 목록에 있는 경우 허용
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true); // 허용
        } else {
            console.warn(`CORS: Not allowed by origin: ${origin}`);
            callback(new Error('Not allowed by CORS')); // 차단
        }
    },
    methods: ['GET', 'POST'], // 허용할 HTTP 메서드
    credentials: true, // 자격 증명(쿠키, 인증 헤더) 허용 여부 (현재 앱에서는 사용 안 함)
    optionsSuccessStatus: 204 // Preflight 요청 성공 시 상태 코드
}));

// 3. 정적 파일 서빙 설정
// `/uploads` URL 경로로 접근하면 `frontend/uploads` 폴더의 파일들을 직접 제공합니다.
// 예를 들어, `http://localhost:3000/uploads/image.jpg`로 접근 가능
const uploadDir = path.join(__dirname, '../frontend/uploads');
app.use('/uploads', express.static(uploadDir));
console.log('Serving static files from:', uploadDir);

// 4. Multer 설정 (이미지 업로드 미들웨어)
const storage = multer.diskStorage({
    // 파일이 저장될 목적지 폴더 설정
    destination: function (req, file, cb) {
        // uploads 폴더가 없으면 자동으로 생성
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // 파일을 uploads 폴더에 저장
    },
    // 저장될 파일 이름 설정
    filename: function (req, file, cb) {
        // 파일명: 현재 타임스탬프_원본 파일명.확장자 형식으로 중복 방지
        cb(null, Date.now() + '_' + file.originalname);
    }
});
const upload = multer({ storage: storage });


// --- 데이터베이스 초기화 및 연결 ---
// SQLite 데이터베이스 파일은 `backend` 폴더 내에 `banjiha.db`라는 이름으로 생성됩니다.
// `sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE`는 읽기/쓰기 모드로 열고, 파일이 없으면 생성합니다.
let db = new sqlite3.Database('./banjiha.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        // 데이터베이스 연결 중 오류 발생 시 콘솔에 에러 출력
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the banjiha SQLite database.');
        // 데이터베이스 연결 성공 후, 테이블 생성 및 초기 데이터 삽입 작업을 직렬화(serialize)하여 순서대로 실행
        db.serialize(() => {
            // posts 테이블 생성 (게시물 데이터 저장)
            db.run(`CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,   -- 게시물 고유 ID (자동 증가)
                title TEXT NOT NULL,                    -- 게시물 제목 (필수)
                content TEXT NOT NULL,                  -- 게시물 내용 (HTML 포함 가능, 필수)
                author TEXT DEFAULT '익명',             -- 작성자 (기본값 '익명')
                date TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')), -- 작성일시 (로컬 시간)
                likes INTEGER DEFAULT 0,                -- 좋아요 수 (기본값 0)
                dislikes INTEGER DEFAULT 0,             -- 싫어요 수 (기본값 0)
                category TEXT DEFAULT 'main',           -- 게시물 카테고리 (main, freeboard, rooms, notice)
                room_slug TEXT DEFAULT NULL             -- 'rooms' 카테고리일 경우 어떤 방에 속하는지 식별자 (NULL 가능)
            )`, (err) => {
                if (err) console.error('Error creating posts table:', err.message);
                else console.log('Posts table created or already exists.');
            });

            // comments 테이블 생성 (댓글 데이터 저장)
            db.run(`CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,   -- 댓글 고유 ID (자동 증가)
                post_id INTEGER NOT NULL,               -- 해당 댓글이 속한 게시물 ID (필수)
                comment_text TEXT NOT NULL,             -- 댓글 내용 (필수)
                author TEXT DEFAULT '익명',             -- 작성자 (기본값 '익명')
                date TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')), -- 작성일시
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE -- 게시물 삭제 시 댓글도 함께 삭제
            )`, (err) => {
                if (err) console.error('Error creating comments table:', err.message);
                else console.log('Comments table created or already exists.');
            });

            // rooms 테이블 생성 (방 데이터 저장)
            db.run(`CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,   -- 방 고유 ID (자동 증가)
                name TEXT NOT NULL UNIQUE,              -- 방 이름 (필수, 고유해야 함)
                slug TEXT NOT NULL UNIQUE,              -- URL에 사용될 고유 식별자 (필수, 고유해야 함)
                description TEXT                        -- 방 설명
            )`, (err) => {
                if (err) console.error('Error creating rooms table:', err.message);
                else console.log('Rooms table created or already exists.');
            });

            // 초기 rooms 데이터 삽입 (기존 데이터 삭제 후 필수 방만 추가)
            // 이 부분은 개발 편의를 위한 것으로, 실제 서비스에서는 데이터베이스 마이그레이션 도구를 사용해야 합니다.
            // DELETE 문 실행 후 INSERT를 통해 방 목록을 초기화하고 재삽입합니다.
            db.run("DELETE FROM rooms", (err) => {
                if (err && !err.message.includes('no such table')) { // 'no such table' 오류가 아니면 진짜 에러
                    console.error("Error deleting existing rooms for re-initialization:", err.message);
                }
                // 기존 방 데이터 삭제 후, 방이 없는 경우에만 초기 방 데이터 삽입
                db.get("SELECT COUNT(*) AS count FROM rooms", (err, row) => {
                    if (err) { console.error("Error checking room count for re-initialization:", err.message); return; }
                    if (row.count === 0) { // 방이 하나도 없을 때만 초기 방 데이터를 삽입
                        const stmt = db.prepare("INSERT INTO rooms (name, slug, description) VALUES (?, ?, ?)");
                        stmt.run("유머방", "humor-room", "웃긴 이야기, 짤방 등 유머 코드를 공유하는 공간입니다.");
                        stmt.run("학교방", "school-room", "학교 생활, 학업 고민 등을 나누는 공간입니다.");
                        stmt.run("게임방", "game-room", "최신 게임 소식, 전략, 함께 할 친구를 찾아요.");
                        stmt.run("일상방", "daily-room", "소소한 일상, 오늘 있었던 일 등을 편하게 이야기해요.");
                        stmt.run("질문방", "qna-room", "궁금한 것을 질문하고 답을 얻는 공간입니다.");
                        stmt.run("수다방", "chat-room", "자유롭게 수다 떨고 친목을 다지는 공간입니다.");
                        stmt.finalize(); // finalize 호출 추가
                    } else {
                         console.log('Rooms table already has data, skipping initial room insertion.');
                    }
                });
            });

            // 초기 posts 데이터 삽입
            db.get("SELECT COUNT(*) AS count FROM posts", (err, row) => {
                if (err) { console.error("Error checking post count:", err.message); return; }
                if (row.count === 0) { // posts 테이블에 데이터가 없을 때만 삽입
                    const stmt = db.prepare("INSERT INTO posts (title, content, category, room_slug, likes) VALUES (?, ?, ?, ?, ?)");
                    stmt.run("안녕하세요! 반지하 익명 커뮤니티에 오신 것을 환영합니다!", "<p>자유롭게 의견을 나누고 소통해보세요. <strong>강조된 텍스트</strong>도 사용할 수 있습니다.</p><p><br></p><p>이미지 예시: <img src='http://localhost:3000/uploads/example_image.jpg' alt='예시 이미지'></p>", "main", null, 15);
                    stmt.run("오늘의 점심 메뉴 추천해주세요!", "<p>오늘 점심으로 뭘 먹어야 할지 고민되네요. 혹시 맛집 추천해주실 분 계신가요?</p>", "main", null, 8);
                    
                    stmt.run("반지하의 첫 자유 게시글", "<p>익명으로 자유롭게 이야기 나누는 공간입니다. 다들 편하게 글 남겨주세요!</p>", "freeboard", null, 22);
                    stmt.run("요즘 볼만한 드라마/영화 추천받아요!", "<p>혹시 요즘 재밌게 본 드라마나 영화 있으신가요? <em>추천 부탁드려요!</em></p>", "freeboard", null, 12);
                    
                    // 새로운 방 슬러그에 맞춘 게시물 추가
                    stmt.run("오늘의 유머! ㅋㅋㅋ", "<p>세상에서 가장 뜨거운 바다는? 열바다! 🤣</p>", "rooms", "humor-room", 40);
                    stmt.run("웃긴 썰 하나 풀어봄", "<p>얼마 전 있었던 웃긴 일입니다. 다들 공감하시려나?</p>", "rooms", "humor-room", 35);
                    
                    stmt.run("시험 기간 공부 팁 공유해요", "<p>다들 시험 공부 어떻게 하시나요? 저만의 꿀팁은 이겁니다!</p>", "rooms", "school-room", 20);
                    stmt.run("졸업 후 뭐 할지 고민이에요", "<p>취업, 대학원, 유학... 다들 어떻게 결정하셨나요?</p>", "rooms", "school-room", 18);

                    stmt.run("최근 출시된 대작 게임 리뷰", "<p>이 게임 해보셨나요? 정말 최고입니다!</p>", "rooms", "game-room", 50);
                    stmt.run("같이 롤하실 분 구합니다!", "<p>실버 티어, 듀오 구해요! 잘 부탁드립니다~</p>", "rooms", "game-room", 25);

                    stmt.run("오늘의 소확행 자랑합니다!", "<p>퇴근길에 예쁜 노을 봤어요. 작은 행복입니다.</p>", "rooms", "daily-room", 17);
                    stmt.run("집에서 간단히 만들 수 있는 요리 추천?", "<p>자취생 요리 팁 부탁해요!</p>", "rooms", "daily-room", 10);
                    
                    stmt.run("코딩 질문 있습니다. 도와주세요!", "<p>자바스크립트 비동기 처리 이해가 어려워요. 설명해주실 분?</p>", "rooms", "qna-room", 14);
                    stmt.run("이직 고민, 현직자분들 조언 부탁드립니다.", "<p>지금 회사에서 다른 회사로 이직 고민 중인데...</p>", "rooms", "qna-room", 11);

                    stmt.run("다들 주말에 뭐 하시나요?", "<p>심심한데 다들 뭐하시는지 궁금하네요~ 수다 떨어요!</p>", "rooms", "chat-room", 7);
                    stmt.run("MBTI별 특징 수다방", "<p>나는 INFP인데 다들 어떤 MBTI인가요? ㅋㅋㅋ</p>", "rooms", "chat-room", 5);

                    stmt.run("사이트 업데이트 안내 (2024-05-23)", "<p>새로운 기능 추가 및 버그 수정이 완료되었습니다. <u>더 나은 서비스를 위해 계속 노력하겠습니다.</u></p>", "notice", null, 5);
                    stmt.run("이용 약관 변경 안내", "<p>2024년 6월 1일부터 새로운 이용 약관이 적용됩니다. 자세한 내용은 클릭하여 확인해주세요.</p>", "notice", null, 3);
                    
                    stmt.finalize(); // finalize 호출 추가
                }
            });
        });
    }
});


// --- API 엔드포인트 정의 ---

// 1. 모든 게시물 조회
// 필터: category, roomSlug
// 정렬: sortBy (date: 최신순, likes: 좋아요순)
app.get('/api/posts', (req, res) => {
    const { category, roomSlug, sortBy = 'date' } = req.query;
    let sql = "SELECT id, title, author, date, category, room_slug, likes, dislikes FROM posts";
    let params = [];
    let conditions = [];

    if (category) {
        conditions.push("category = ?");
        params.push(category);
    }
    if (roomSlug) {
        conditions.push("room_slug = ?");
        params.push(roomSlug);
    } else if (['main', 'freeboard', 'notice'].includes(category)) {
        conditions.push("room_slug IS NULL");
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    
    if (sortBy === 'likes') sql += " ORDER BY likes DESC, id DESC";
    else sql += " ORDER BY id DESC"; // id는 자동 증가이므로 최신순과 동일

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching posts:", err.message);
            res.status(500).json({"error": "Failed to fetch posts: " + err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// 2. 특정 게시물 상세 조회
app.get('/api/posts/:id', (req, res) => {
    const postId = req.params.id;
    db.get("SELECT * FROM posts WHERE id = ?", [postId], (err, post) => {
        if (err) {
            console.error("Error fetching single post:", err.message);
            res.status(500).json({"error": "Failed to fetch post: " + err.message});
            return;
        }
        if (!post) {
            res.status(404).json({"message": "Post not found"});
            return;
        }
        db.all("SELECT * FROM comments WHERE post_id = ? ORDER BY date ASC", [postId], (err, comments) => {
            if (err) {
                console.error("Error fetching comments:", err.message);
                res.status(500).json({"error": "Failed to fetch comments: " + err.message});
                return;
            }
            res.json({
                "message": "success",
                "data": { post, comments }
            });
        });
    });
});

// 3. 새 게시물 작성
app.post('/api/posts', (req, res) => {
    const { title, content, author, category, roomSlug } = req.body;
    if (!title || !content) {
        res.status(400).json({ "error": "Title and content are required." });
        return;
    }
    const actualAuthor = author || '익명';
    const actualCategory = category || 'main';
    const actualRoomSlug = roomSlug || null;

    db.run(`INSERT INTO posts (title, content, author, category, room_slug) VALUES (?, ?, ?, ?, ?)`,
        [title, content, actualAuthor, actualCategory, actualRoomSlug],
        function(err) {
            if (err) {
                console.error("Error inserting new post:", err.message);
                res.status(500).json({"error": "Failed to create post: " + err.message});
                return;
            }
            res.status(201).json({ "message": "success", "data": { id: this.lastID, title, content, author: actualAuthor, category: actualCategory, room_slug: actualRoomSlug, date: new Date().toISOString().slice(0, 19).replace('T', ' '), likes: 0, dislikes: 0 }});
        }
    );
});

// 4. 댓글 작성
app.post('/api/posts/:id/comments', (req, res) => {
    const postId = req.params.id;
    const { comment_text, author } = req.body;
    if (!comment_text) { res.status(400).json({ "error": "Comment text is required." }); return; }
    const actualAuthor = author || '익명';

    db.run(`INSERT INTO comments (post_id, comment_text, author) VALUES (?, ?, ?)`,
        [postId, comment_text, actualAuthor],
        function(err) {
            if (err) {
                console.error("Error inserting new comment:", err.message);
                res.status(500).json({"error": "Failed to create comment: " + err.message});
                return;
            }
            res.status(201).json({ "message": "success", "data": { id: this.lastID, post_id: postId, comment_text, author: actualAuthor, date: new Date().toISOString().slice(0, 19).replace('T', ' ') }});
        }
    );
});

// 5. 게시물 좋아요/싫어요 기능
app.post('/api/posts/:id/:action', (req, res) => {
    const { id: postId, action } = req.params;
    let columnName;
    if (action === 'like') columnName = 'likes';
    else if (action === 'dislike') columnName = 'dislikes';
    else { res.status(400).json({ "error": "Invalid action. Use 'like' or 'dislike'." }); return; }

    db.run(`UPDATE posts SET ${columnName} = ${columnName} + 1 WHERE id = ?`, [postId], function(err) {
        if (err) {
            console.error(`Error updating ${action} for post:`, err.message);
            res.status(500).json({"error": `Failed to update ${action}: ` + err.message});
            return;
        }
        db.get(`SELECT ${columnName} FROM posts WHERE id = ?`, [postId], (err, row) => {
            if (err) {
                res.status(500).json({"error": `Failed to get updated ${action} count: ` + err.message});
                return;
            }
            res.json({ "message": "success", "data": { id: postId, [columnName]: row[columnName] }});
        });
    });
});

// 6. rooms 목록 조회
app.get('/api/rooms', (req, res) => {
    db.all("SELECT id, name, slug, description FROM rooms ORDER BY name ASC", [], (err, rows) => {
        if (err) {
            console.error("Error fetching rooms:", err.message);
            res.status(500).json({"error": "Failed to fetch rooms: " + err.message});
            return;
        }
        res.json({ "message": "success", "data": rows });
    });
});

// 7. 이미지 업로드
app.post('/api/upload/image', upload.single('image'), (req, res) => {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded.' }); return; }
    const imageUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
    res.status(200).json({ url: imageUrl });
});

// 8. 통합 검색 API
app.get('/api/search/posts', (req, res) => {
    const query = req.query.q;
    if (!query) { res.status(400).json({ "error": "Search query 'q' is required." }); return; }
    const likeQuery = `%${query}%`;
    const sql = `SELECT id, title, author, date, category, room_slug, likes, dislikes FROM posts WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC`;
    db.all(sql, [likeQuery, likeQuery], (err, rows) => {
        if (err) { res.status(500).json({"error": "Failed to search posts: " + err.message}); return; }
        res.json({ "message": "success", "data": rows });
    });
});

// 9. 최신 게시물 5개 조회 API
app.get('/api/latest_posts', (req, res) => {
    const sql = `SELECT id, title, author, date, category, room_slug FROM posts ORDER BY id DESC LIMIT 5`;
    db.all(sql, [], (err, rows) => {
        if (err) { res.status(500).json({"error": "Failed to fetch latest posts: " + err.message}); return; }
        res.json({ "message": "success", "data": rows });
    });
});

// 10. 방 생성
app.post('/api/rooms', (req, res) => {
    const { name, description } = req.body;
    if (!name) { res.status(400).json({ "error": "Room name is required." }); return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) { res.status(400).json({ "error": "Room name cannot be converted to a valid slug." }); return; }

    db.run(`INSERT INTO rooms (name, slug, description) VALUES (?, ?, ?)`,
        [name, slug, description || ''],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) res.status(409).json({ "error": "Room name or slug already exists." });
                else res.status(500).json({"error": "Failed to create room: " + err.message});
            } else { res.status(201).json({ "message": "success", "data": { id: this.lastID, name, slug, description: description || '' }}); }
        }
    );
});


// --- 서버 시작 및 종료 처리 ---
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) console.error('Error closing database connection:', err.message);
        else console.log('Closed the database connection.');
        process.exit(0);
    });
});
