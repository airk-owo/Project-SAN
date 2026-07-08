import 'dotenv/config';
import { createServer } from './server.js';

// Entry point เท่านั้น — โครงสร้าง express/socket.io และ handler ทั้งหมดอยู่ใน server.ts (createServer)
// เพื่อให้เทสต์บูตเซิร์ฟเวอร์ in-process บนพอร์ต 0 ได้โดยไม่ชนพอร์ตจริง

// Safety net: state เกมทั้งหมดอยู่ใน memory — ปล่อยให้ error ที่หลุด handler ฆ่า process
// เท่ากับทุกห้องหายพร้อมกัน จึงเลือก log แล้วรันต่อ (ยอมเสี่ยง state เกมเดียวเพี้ยน)
// ติดตั้งที่ entry เท่านั้น เพื่อไม่ให้เทสต์ที่บูต createServer() ติด global handler ไปด้วย
process.on('unhandledRejection', reason => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', error => console.error('[uncaughtException]', error));

const { httpServer } = await createServer();
httpServer.listen(Number(process.env.PORT || process.env.SOCKET_PORT || 3001), () => console.log('WTK socket server ready'));
