const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload only images.'), false);
        }
    }
});

const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

router.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const fileExtension = path.extname(req.file.originalname) || '.jpg';
        const fileName = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);

        await sharp(req.file.buffer)
            .resize(1200, 1200, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 85 })
            .toFile(filePath);

        const imageUrl = `/uploads/${fileName}`;
        
        res.json({
            success: true,
            url: imageUrl,
            filename: fileName,
            originalName: req.file.originalname
        });

    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

router.post('/resize-image', express.json(), async (req, res) => {
    try {
        const { imageUrl, width, height } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        const fileName = path.basename(imageUrl);
        const originalPath = path.join(uploadsDir, fileName);
        
        if (!fs.existsSync(originalPath)) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const resizedFileName = `resized-${width}x${height}-${fileName}`;
        const resizedPath = path.join(uploadsDir, resizedFileName);

        await sharp(originalPath)
            .resize(parseInt(width), parseInt(height), {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 85 })
            .toFile(resizedPath);

        const resizedUrl = `/uploads/${resizedFileName}`;
        
        res.json({
            success: true,
            url: resizedUrl,
            filename: resizedFileName,
            width: parseInt(width),
            height: parseInt(height)
        });

    } catch (error) {
        console.error('Image resize error:', error);
        res.status(500).json({ error: 'Failed to resize image' });
    }
});

router.delete('/delete-image', express.json(), async (req, res) => {
    try {
        const { imageUrl } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        const fileName = path.basename(imageUrl);
        const filePath = path.join(uploadsDir, fileName);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'Image deleted successfully' });
        } else {
            res.status(404).json({ error: 'Image not found' });
        }

    } catch (error) {
        console.error('Image delete error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

router.get('/image-info/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(uploadsDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const metadata = await sharp(filePath).metadata();
        const stats = fs.statSync(filePath);
        
        res.json({
            success: true,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            }
        });

    } catch (error) {
        console.error('Image info error:', error);
        res.status(500).json({ error: 'Failed to get image information' });
    }
});

router.post('/generate-thumbnail', express.json(), async (req, res) => {
    try {
        const { imageUrl, size = 150 } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        const fileName = path.basename(imageUrl);
        const originalPath = path.join(uploadsDir, fileName);
        
        if (!fs.existsSync(originalPath)) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const thumbFileName = `thumb-${size}-${fileName}`;
        const thumbPath = path.join(uploadsDir, thumbFileName);

        await sharp(originalPath)
            .resize(parseInt(size), parseInt(size), {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);

        const thumbUrl = `/uploads/${thumbFileName}`;
        
        res.json({
            success: true,
            url: thumbUrl,
            filename: thumbFileName,
            size: parseInt(size)
        });

    } catch (error) {
        console.error('Thumbnail generation error:', error);
        res.status(500).json({ error: 'Failed to generate thumbnail' });
    }
});

module.exports = router;