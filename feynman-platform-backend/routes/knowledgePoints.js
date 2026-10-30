// routes/knowledgePoints.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // 引入认证中间件
const KnowledgePoint = require('../models/KnowledgePoint');
const FeynmanAttempt = require('../models/FeynmanAttempt');

const STATUS_VALUES = ['not_started', 'in_progress', 'mastered'];

// @route   POST /api/knowledge-points
// @desc    创建一个新的知识点
// @access  Private (需要登录)
router.post('/', auth, async (req, res) => { // 在这里使用auth中间件
    try {
        const { title, content, status } = req.body;

        if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
            return res.status(400).json({ msg: 'title and content are required' });
        }

        const newKp = new KnowledgePoint({
            title: title.trim(),
            content,
            // 新建时允许直接指定学习状态，非法值回退为 not_started
            status: STATUS_VALUES.includes(status) ? status : 'not_started',
            user: req.user.id // 从auth中间件附加的req.user中获取用户ID
        });
        const kp = await newKp.save();
        res.status(201).json(kp);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/knowledge-points
// @desc    获取当前用户的所有知识点
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const kps = await KnowledgePoint.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(kps);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/knowledge-points/:id
// @desc    获取单个知识点详情
// @access  Private
router.get('/:id', auth, async (req, res) => {
	try {
		const kp = await KnowledgePoint.findById(req.params.id);
		if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
		// 只能查看自己的知识点
		if (kp.user.toString() !== req.user.id) {
			return res.status(401).json({ msg: 'Not authorized' });
		}
		res.json(kp);
	} catch (err) {
		console.error(err.message);
		res.status(500).send('Server Error');
	}
});
// @route   PUT /api/knowledge-points/:id
// @desc    更新一个知识点
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        let kp = await KnowledgePoint.findById(req.params.id);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        // 确保是该用户自己的知识点
        if (kp.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        const { title, content, status, reviewList } = req.body;
        const updates = { title, content, reviewList };
        // 只接受合法的状态值，避免写入未知状态
        if (STATUS_VALUES.includes(status)) {
            updates.status = status;
        }
        kp = await KnowledgePoint.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true } // 返回更新后的文档
        );
        res.json(kp);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/knowledge-points/:id
// @desc    删除一个知识点
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        let kp = await KnowledgePoint.findById(req.params.id);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        await KnowledgePoint.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Knowledge point removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/knowledge-points/:id/attempts
// @desc    保存一次费曼复述（录音转录结果）
// @access  Private
router.post('/:id/attempts', auth, async (req, res) => {
    try {
        const kp = await KnowledgePoint.findById(req.params.id);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const transcript = typeof req.body.transcript === 'string' ? req.body.transcript.trim() : '';
        if (!transcript) {
            return res.status(400).json({ msg: 'transcript is required' });
        }

        const attempt = await new FeynmanAttempt({
            user: req.user.id,
            knowledgePoint: kp._id,
            transcript,
        }).save();

        res.status(201).json(attempt);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/knowledge-points/:id/attempts
// @desc    获取某个知识点的复述记录（最近 20 条）
// @access  Private
router.get('/:id/attempts', auth, async (req, res) => {
    try {
        const kp = await KnowledgePoint.findById(req.params.id);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const attempts = await FeynmanAttempt.find({
            user: req.user.id,
            knowledgePoint: kp._id,
        })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(attempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;