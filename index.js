const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 4000;

// يمكن استخدام dotenv لقراءة MONGODB_URI من ملف .env
require('dotenv').config();
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);

app.use(cors());
app.use(express.json());

const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('الملف المرفوع يجب أن يكون صورة'));
    }
    cb(null, true);
  }
});

app.use('/uploads', express.static('uploads'));

async function run() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('mydatabase');
    const postsCollection = db.collection('posts');

    app.post('/api/post', upload.single('image'), async (req, res) => {
      const content = req.body.content;
      const image = req.file ? req.file.filename : null;

      if (!content || content.trim() === '') {
        return res.status(400).json({ message: 'نص المنشور مطلوب' });
      }

      const newPost = {
        userName: req.body.userName || 'مستخدم',
        content,
        imageUrl: image ? `/uploads/${image}` : null,
        createdAt: new Date()
      };

      const result = await postsCollection.insertOne(newPost);
      res.status(201).json({ message: 'تم إضافة المنشور', postId: result.insertedId });
    });

    app.get('/api/posts', async (req, res) => {
      const posts = await postsCollection.find().sort({ createdAt: -1 }).toArray();
      res.status(200).json(posts);
    });

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${port}`);
    });

  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);
