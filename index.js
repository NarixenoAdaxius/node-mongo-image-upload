const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { GridFsStorage } = require("multer-gridfs-storage");
const sharp = require("sharp");
require("dotenv").config();

const url = process.env.MONGO_DB_URL;

mongoose.connect(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const mongoClient = mongoose.connection;

const storage = new GridFsStorage({
  url,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      sharp(file.buffer)
        .resize({ width: 800, height: 600, fit: sharp.fit.inside })
        .toBuffer()
        .then((data) => {
          resolve({
            bucketName: "photos",
            filename: `${Date.now()}_${file.originalname}`,
            options: {
              chunkSizeBytes: 1024 * 1024 * 4,
              metadata: {
                userId: req.user._id,
              },
            },
            contentType: file.mimetype,
            metadata: {
              userId: req.user._id,
            },
            buffer: data,
          });
        })
        .catch((error) => {
          reject(error);
        });
    });
  },
});

const upload = multer({ storage });

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/upload/image", upload.single("image"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send({
      message: "Error: No file uploaded",
    });
  }
  res.send({
    message: "Uploaded",
    id: file.id,
    name: file.filename,
    contentType: file.contentType,
  });
});

app.get("/images", async (req, res) => {
  try {
    const database = mongoClient.db("images");
    const images = database.collection("photos.files");
    const cursor = images.find({});
    const count = await cursor.count();
    if (count === 0) {
      return res.status(404).send({
        message: "Error: No Images found",
      });
    }

    const allImages = await cursor.toArray();

    res.send({ files: allImages });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Error Something went wrong",
      error,
    });
  }
});

app.get("/download/:filename", async (req, res) => {
  try {
    const database = mongoClient.db("images");

    const imageBucket = new mongoose.mongo.GridFSBucket(database, {
      bucketName: "photos",
    });

    let downloadStream = imageBucket.openDownloadStreamByName(
      req.params.filename
    );

    downloadStream.pipe(res);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Error Something went wrong",
      error,
    });
  }
});

const PORT = process.env.PORT || 8765;
const server = app.listen(PORT, () => {
  console.log("App started at port:", PORT);
});
