const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

app.use(cors());
app.use(express.json());

const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
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
      return cb(new Error('Uploaded file must be an image'));
    }
    cb(null, true);
  }
});

app.use('/uploads', express.static(uploadFolder));

async function run() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('mydatabase');
    const postsCollection = db.collection('posts');
    const playersCollection = db.collection('players');

    // إضافة منشور
    app.post('/api/post', upload.single('image'), async (req, res) => {
      const content = req.body.content;
      const image = req.file ? req.file.filename : null;

      if (!content || content.trim() === '') {
        return res.status(400).json({ message: 'Post content is required' });
      }

      const newPost = {
        userName: req.body.userName || 'User',
        content,
        imageUrl: image ? `/uploads/${image}` : null,
        createdAt: new Date()
      };

      const result = await postsCollection.insertOne(newPost);
      res.status(201).json({ message: 'Post added successfully', postId: result.insertedId });
    });

    // جلب المنشورات
    app.get('/api/posts', async (req, res) => {
      const posts = await postsCollection.find().sort({ createdAt: -1 }).toArray();
      res.status(200).json(posts);
    });

    // إضافة لاعب
    app.post('/api/players/add', upload.single('image'), async (req, res) => {
      const { name, biography } = req.body;
      const image = req.file ? req.file.filename : null;

      if (!name || !biography) {
        return res.status(400).json({ message: 'Name and biography are required' });
      }

      const newPlayer = {
        name,
        biography,
        imageUrl: image ? `/uploads/${image}` : null,
        visits: 0,
        createdAt: new Date()
      };

      try {
        const result = await playersCollection.insertOne(newPlayer);
        res.status(201).json({ message: 'Player added successfully', playerId: result.insertedId });
      } catch (err) {
        res.status(500).json({ message: 'Database error' });
      }
    });

    // جلب اللاعبين
    app.get('/api/players', async (req, res) => {
      try {
        const players = await playersCollection.find().sort({ createdAt: -1 }).toArray();
        res.status(200).json(players);
      } catch (err) {
        res.status(500).json({ message: 'Database error' });
      }
    });

    // زيادة عدد الزيارات للاعب
    app.post('/api/players/:id/visit', async (req, res) => {
      const playerId = req.params.id;

      try {
        const result = await playersCollection.updateOne(
          { _id: new ObjectId(playerId) },
          { $inc: { visits: 1 } }
        );

        if (result.modifiedCount === 1) {
          res.json({ message: 'Visit count incremented' });
        } else {
          res.status(404).json({ message: 'Player not found' });
        }
      } catch (err) {
        res.status(400).json({ message: 'Invalid player ID' });
      }
    });

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
    });

  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);
