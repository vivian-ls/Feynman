// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 1. 从请求头中获取token
    // 兼容两种写法：
    //   a) 课程自定义头：x-auth-token: <token>
    //   b) 标准写法（Postman 的 Authorization -> Bearer Token）：
    //      Authorization: Bearer <token>
    let token = req.header('x-auth-token');

    if (!token) {
        const authHeader = req.header('Authorization') || req.header('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7).trim(); // 去掉 "Bearer " 前缀
        }
    }

    // 2. 检查token是否存在
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' }); // 401: 未授权
    }

    // 3. 验证token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 将解码后的用户信息（特别是user.id）附加到请求对象上
        req.user = decoded.user; 
        
        // 调用next()，将控制权交给下一个中间件或路由处理器
        next();

    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};