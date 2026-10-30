// work/check-users.js —— 只读排查脚本：看看数据库中实际有哪些用户（临时文件，用完可删）
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'username email createdAt').sort({ createdAt: 1 });
    console.log('当前数据库:', mongoose.connection.db.databaseName);
    console.log('用户总数:', users.length);
    users.forEach((u, i) => {
        console.log(`${i + 1}. username=${u.username}  email=${u.email}  注册时间=${u.createdAt ? u.createdAt.toISOString() : 'N/A'}`);
    });

    const target = '123@123';
    const hit = users.find(u => u.email === target);
    console.log('\n查询 email =', target, '=>', hit ? `存在（username=${hit.username}）` : '不存在，登录会返回 Invalid Credentials');
    await mongoose.disconnect();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
