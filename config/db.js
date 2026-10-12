const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("🚀 Trying to connect to MongoDB...");

    // 1. التحقق المباشر من وجود رابط قاعدة البيانات
    if (!process.env.MONGO_DB_URL) {
      throw new Error("MONGO_DB_URL is missing in .env file");
    }

    console.log("🔗 MONGO_DB_URL: ✅ Loaded");

    // 2. استخدام await وحفظ نتيجة الاتصال في المتغير conn
    const conn = await mongoose.connect(process.env.MONGO_DB_URL);

    // 3. طباعة اسم الـ Host بنجاح بعد اكتمال الاتصال
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ Error connecting to MongoDB: ${err.message}`);
    process.exit(1); // إيقاف الخادم فوراً إذا فشل الاتصال بقاعدة البيانات
  }
};

module.exports = connectDB;