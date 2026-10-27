import { Router } from 'express';
import { chats, courseMaterials, courses, message, openChat, showChat } from '../controllers/student-assistant.controller';

export const studentAssistantRouter = Router();

studentAssistantRouter.get('/courses', courses);
studentAssistantRouter.get('/courses/:courseId/materials', courseMaterials);
studentAssistantRouter.get('/chats', chats);
studentAssistantRouter.post('/chats', openChat);
studentAssistantRouter.get('/chats/:chatId', showChat);
studentAssistantRouter.post('/chats/:chatId/messages', message);
