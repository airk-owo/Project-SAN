import 'dotenv/config';
import { createServer } from './server.js';

// Entry point เท่านั้น — โครงสร้าง express/socket.io และ handler ทั้งหมดอยู่ใน server.ts (createServer)
// เพื่อให้เทสต์บูตเซิร์ฟเวอร์ in-process บนพอร์ต 0 ได้โดยไม่ชนพอร์ตจริง
const { httpServer } = await createServer();
httpServer.listen(Number(process.env.PORT || process.env.SOCKET_PORT || 3001), () => console.log('WTK socket server ready'));
