// backend/server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer'); // 이미지 업로드용
const path = require('path'); // 파일 경로 처리용
const fs = require('fs'); // 파일 시스템 처리용

const app = express();
const port = 3000;

// 미들웨어 설정
app.use(express.json());
app.use(cors());

// 정적 파일 서빙: frontend/uploads 폴더를 /uploads 경로로 접근 가능하게 함
app.use('/uploads', express.static(path.join(__dirname, '../frontend/uploads')));
console.log('Serving static files from:', path.join(__dirname, '../frontend/uploads'));

// Multer 설정 (이미지 업로드)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../frontend/uploads');
        // uploads 폴더가 없으면 생성
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 파일명: 현재 시간_원본파일명.확장자
        cb(null, Date.now() + '_' + file.originalname);
    }
});
const upload = multer({ storage: storage });


// 데이터베이스 초기화 및 연결
let db = new sqlite3.Database('./banjiha.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    }
    console.log('Connected to the banjiha SQLite database.');
});

// 데이터베이스 테이블 생성
db.serialize(() => {
    // 게시물 테이블 (category와 room_slug 컬럼 추가)
    // content는 HTML을 저장할 것이므로 TEXT로 유지
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL, -- HTML 내용을 저장할 것이므로 TEXT 유지
        author TEXT DEFAULT '익명',
        date TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
        likes INTEGER DEFAULT 0,
        dislikes INTEGER DEFAULT 0,
        category TEXT DEFAULT 'main', -- 'main', 'freeboard', 'rooms', 'notice'
        room_slug TEXT DEFAULT NULL -- rooms 카테고리일 경우 어떤 방에 속하는지 식별
    )`, (err) => {
        if (err) {
            console.error('Error creating posts table:', err.message);
        } else {
            console.log('Posts table created or already exists.');
        }
    });

    // 댓글 테이블
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        comment_text TEXT NOT NULL,
        author TEXT DEFAULT '익명',
        date TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('Error creating comments table:', err.message);
        } else {
            console.log('Comments table created or already exists.');
        }
    });

    // rooms 테이블
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE, -- URL에 사용될 고유 식별자
        description TEXT
    )`, (err) => {
        if (err) {
            console.error('Error creating rooms table:', err.message);
        } else {
            console.log('Rooms table created or already exists.');
        }
    });


    // 초기 데이터 삽입 (posts 테이블)
    db.get("SELECT COUNT(*) AS count FROM posts", (err, row) => {
        if (err) {
            console.error("Error checking post count:", err.message);
            return;
        }
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO posts (title, content, category, room_slug, likes) VALUES (?, ?, ?, ?, ?)");
            stmt.run("안녕하세요! 반지하 익명 커뮤니티에 오신 것을 환영합니다!", "<p>자유롭게 의견을 나누고 소통해보세요. <strong>강조된 텍스트</strong>도 사용할 수 있습니다.</p><p><br></p><p>이미지 예시: <img src='http://localhost:3000/uploads/example_image.jpg' alt='예시 이미지'></p>", "main", null, 15);
            stmt.run("오늘의 점심 메뉴 추천해주세요!", "<p>오늘 점심으로 뭘 먹어야 할지 고민되네요. 혹시 맛집 추천해주실 분 계신가요?</p>", "main", null, 8);
            
            stmt.run("반지하의 첫 자유 게시글", "<p>익명으로 자유롭게 이야기 나누는 공간입니다. 다들 편하게 글 남겨주세요!</p>", "freeboard", null, 22);
            stmt.run("요즘 볼만한 드라마/영화 추천받아요!", "<p>혹시 요즘 재밌게 본 드라마나 영화 있으신가요? <em>추천 부탁드려요!</em></p>", "freeboard", null, 12);
            
            // --- room_slug가 있는 게시물 추가 (기본 방에만 추가) ---
            stmt.run("일상 이야기 방 첫 글", "<p>소소한 일상 이야기, 오늘 있었던 일, 고민 등을 편하게 나눠요.</p>", "rooms", "daily-life", 18);
            stmt.run("오늘 하루 어떠셨나요?", "<p>오늘 하루는 어떠셨나요? 저는 좀 피곤하네요 😴</p>", "rooms", "daily-life", 9);
            stmt.run("요즘 푹 빠진 게임 추천!", "<p>다들 어떤 게임하시나요? 저는 요즘 이 게임에 빠져있어요!</p>", "rooms", "games", 30);
            stmt.run("웃긴 썰 하나 풀어볼까요?", "<p>제가 겪었던 황당하고 웃긴 이야기입니다. ㅋㅋㅋㅋ</p>", "rooms", "humor", 25);


            stmt.run("사이트 업데이트 안내 (2024-05-23)", "<p>새로운 기능 추가 및 버그 수정이 완료되었습니다. <u>더 나은 서비스를 위해 계속 노력하겠습니다.</u></p>", "notice", null, 5);
            stmt.run("이용 약관 변경 안내", "<p>2024년 6월 1일부터 새로운 이용 약관이 적용됩니다. 자세한 내용은 클릭하여 확인해주세요.</p>", "notice", null, 3);
            
            stmt.finalize((finalizeErr) => {
                if (finalizeErr) {
                    console.error("Error finalizing initial post insertion:", finalizeErr.message);
                } else {
                    console.log('Initial posts inserted with categories and room_slugs.');
                }
            });
        }
    });

    // 초기 rooms 데이터 삽입 (기존 방 삭제 후 필수 방만 추가)
    // 이전에 있던 모든 rooms 데이터를 삭제하고 새로 추가합니다.
    db.run("DELETE FROM rooms", (err) => {
        if (err) {
            console.error("Error deleting existing rooms:", err.message);
            return;
        }
        console.log("Existing rooms cleared for re-initialization.");

        const stmt = db.prepare("INSERT INTO rooms (name, slug, description) VALUES (?, ?, ?)");
        stmt.run("일상 이야기 방", "daily-life", "소소한 일상과 생각을 나누는 공간입니다.");
        stmt.run("게임 방", "games", "함께 게임하고 싶은 사람, 게임 추천 등 자유롭게 이야기해요.");
        stmt.run("웃긴 방", "humor", "웃긴 썰, 유머 글 등 즐거운 이야기만 모아둡니다.");
        
        stmt.finalize((finalizeErr) => {
            if (finalizeErr) {
                console.error("Error finalizing initial room insertion:", finalizeErr.message);
            } else {
                console.log('Initial rooms (games, daily-life, humor) inserted.');
            }
        });
    });
});


// --- API 엔드포인트 정의 ---

// 1. 모든 게시물 조회 (최신순, 카테고리 및 room_slug 필터링, 정렬 옵션 추가)
app.get('/api/posts', (req, res) => {
    const category = req.query.category;
    const roomSlug = req.query.roomSlug;
    const sortBy = req.query.sortBy || 'date'; // 기본값은 'date' (최신순)

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
    } else if (category === 'main' || category === 'freeboard' || category === 'notice') {
        // 'main', 'freeboard', 'notice' 카테고리에서는 room_slug가 NULL인 게시물만 가져오도록
        conditions.push("room_slug IS NULL");
    }


    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    
    // 정렬 로직 추가
    if (sortBy === 'likes') {
        sql += " ORDER BY likes DESC, id DESC"; // 좋아요가 같으면 최신순
    } else { // 기본값 'date'
        sql += " ORDER BY id DESC"; // id는 자동 증가이므로 최신순과 동일
    }


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

// 2. 특정 게시물 상세 조회 (좋아요/싫어요, 댓글 포함)
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
                "data": {
                    post: post,
                    comments: comments
                }
            });
        });
    });
});

// 3. 새 게시물 작성 (room_slug 컬럼 추가)
app.post('/api/posts', (req, res) => {
    // Quill 에디터에서 전송될 HTML content를 그대로 받음
    const { title, content, author, category, roomSlug } = req.body;
    if (!title || !content) {
        res.status(400).json({ "error": "Title and content are required." });
        return;
    }
    const actualAuthor = author || '익명';
    const actualCategory = category || 'main'; // 카테고리가 없으면 기본값 'main'
    const actualRoomSlug = roomSlug || null; // roomSlug가 없으면 null

    db.run(`INSERT INTO posts (title, content, author, category, room_slug) VALUES (?, ?, ?, ?, ?)`,
        [title, content, actualAuthor, actualCategory, actualRoomSlug],
        function(err) {
            if (err) {
                console.error("Error inserting new post:", err.message);
                res.status(500).json({"error": "Failed to create post: " + err.message});
                return;
            }
            res.status(201).json({
                "message": "success",
                "data": {
                    id: this.lastID,
                    title,
                    content,
                    author: actualAuthor,
                    category: actualCategory,
                    room_slug: actualRoomSlug,
                    date: new Date().toISOString().slice(0, 19).replace('T', ' '),
                    likes: 0,
                    dislikes: 0
                }
            });
        }
    );
});

// 4. 댓글 작성 - 변경 없음
app.post('/api/posts/:id/comments', (req, res) => {
    const postId = req.params.id;
    const { comment_text, author } = req.body;

    if (!comment_text) {
        res.status(400).json({ "error": "Comment text is required." });
        return;
    }
    const actualAuthor = author || '익명';

    db.run(`INSERT INTO comments (post_id, comment_text, author) VALUES (?, ?, ?)`,
        [postId, comment_text, actualAuthor],
        function(err) {
            if (err) {
                console.error("Error inserting new comment:", err.message);
                res.status(500).json({"error": "Failed to create comment: " + err.message});
                return;
            }
            res.status(201).json({
                "message": "success",
                "data": {
                    id: this.lastID,
                    post_id: postId,
                    comment_text,
                    author: actualAuthor,
                    date: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }
            });
        }
    );
});

// 5. 게시물 좋아요/싫어요 기능 - 변경 없음
app.post('/api/posts/:id/:action', (req, res) => {
    const postId = req.params.id;
    const action = req.params.action;

    let columnName;
    if (action === 'like') {
        columnName = 'likes';
    } else if (action === 'dislike') {
        columnName = 'dislikes';
    } else {
        res.status(400).json({ "error": "Invalid action. Use 'like' or 'dislike'." });
        return;
    }

    db.run(`UPDATE posts SET ${columnName} = ${columnName} + 1 WHERE id = ?`, [postId], function(err) {
        if (err) {
            console.error(`Error updating ${action} for post:`, err.message);
            res.status(500).json({"error": `Failed to update ${action}: ` + err.message});
            return;
        }
        db.get(`SELECT ${columnName} FROM posts WHERE id = ?`, [postId], (err, row) => {
            if (err) {
                console.error(`Error fetching updated ${action} count:`, err.message);
                res.status(500).json({"error": `Failed to get updated ${action} count: ` + err.message});
                return;
            }
            res.json({
                "message": "success",
                "data": {
                    id: postId,
                    [columnName]: row[columnName]
                }
            });
        });
    });
});

// 6. rooms 목록 조회 - 변경 없음
app.get('/api/rooms', (req, res) => {
    db.all("SELECT id, name, slug, description FROM rooms ORDER BY name ASC", [], (err, rows) => {
        if (err) {
            console.error("Error fetching rooms:", err.message);
            res.status(500).json({"error": "Failed to fetch rooms: " + err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// 7. 이미지 업로드 - 변경 없음
app.post('/api/upload/image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    // 업로드된 파일의 URL 반환 (예: http://localhost:3000/uploads/123456789_filename.jpg)
    const imageUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
    res.status(200).json({ url: imageUrl });
});

// 8. 통합 검색 API (제목 및 내용으로 검색) - 변경 없음
app.get('/api/search/posts', (req, res) => {
    const query = req.query.q; // 검색어
    if (!query) {
        return res.status(400).json({ "error": "Search query 'q' is required." });
    }

    const likeQuery = `%${query}%`;
    // 제목 또는 내용에 검색어가 포함된 게시물 검색
    const sql = `SELECT id, title, author, date, category, room_slug, likes, dislikes FROM posts WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC`;

    db.all(sql, [likeQuery, likeQuery], (err, rows) => {
        if (err) {
            console.error("Error searching posts:", err.message);
            res.status(500).json({"error": "Failed to search posts: " + err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// 9. 최신 게시물 5개 조회 API - 변경 없음
app.get('/api/latest_posts', (req, res) => {
    // 모든 카테고리에서 최신 5개 게시물 조회
    const sql = `SELECT id, title, author, date, category, room_slug FROM posts ORDER BY id DESC LIMIT 5`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching latest posts:", err.message);
            res.status(500).json({"error": "Failed to fetch latest posts: " + err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// --- 새로 추가된 API 엔드포인트: 방 생성 ---
app.post('/api/rooms', (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ "error": "Room name is required." });
    }

    // 슬러그 생성 (예: "게임 방" -> "game-room")
    const slug = name.toLowerCase()
                     .replace(/[^a-z0-9\s-]/g, '') // 알파벳, 숫자, 공백, 하이픈만 남기고 제거
                     .replace(/\s+/g, '-')         // 여러 공백을 하나의 하이픈으로
                     .replace(/^-+|-+$/g, '');     // 시작/끝 하이픈 제거

    if (!slug) {
        return res.status(400).json({ "error": "Room name cannot be converted to a valid slug." });
    }

    db.run(`INSERT INTO rooms (name, slug, description) VALUES (?, ?, ?)`,
        [name, slug, description || ''],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    // 이름 또는 슬러그가 이미 존재하는 경우
                    return res.status(409).json({ "error": "Room name or slug already exists." });
                }
                console.error("Error inserting new room:", err.message);
                res.status(500).json({"error": "Failed to create room: " + err.message});
                return;
            }
            res.status(201).json({
                "message": "success",
                "data": {
                    id: this.lastID,
                    name,
                    slug,
                    description: description || ''
                }
            });
        }
    );
});


// 서버 시작
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

// 서버 종료 시 데이터베이스 연결 닫기 (Ctrl+C 등)
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database connection:', err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});