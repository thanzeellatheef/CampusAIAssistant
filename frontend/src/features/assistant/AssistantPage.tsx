import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
	createChat,
	getChat,
	listChats,
	sendChatMessage,
	studentCourseMaterials,
	studentCourses,
	type AssistantCourse,
	type CourseMaterial,
	type ChatMessage,
	type ChatSummary,
} from '../../api/assistant';
import { currentCalendar } from '../../api/materials';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/common/Alert';
import { calendarLabel } from '../../components/layout/calendar-label';
import { useAuth } from '../auth/useAuth';

export function AssistantPage() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [termId, setTermId] = useState<number | null>(null);
	const [termLabel, setTermLabel] = useState('');
	const [classLabel, setClassLabel] = useState<string | null>(null);
	const [courses, setCourses] = useState<AssistantCourse[]>([]);
	const [materials, setMaterials] = useState<CourseMaterial[]>([]);
	const [courseId, setCourseId] = useState<number | null>(null);
	const [courseSearch, setCourseSearch] = useState('');
	const [chats, setChats] = useState<ChatSummary[]>([]);
	const [activeChat, setActiveChat] = useState<ChatSummary | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState('');
	const [initialLoading, setInitialLoading] = useState(true);
	const [coursesLoading, setCoursesLoading] = useState(false);
	const [materialsLoading, setMaterialsLoading] = useState(false);
	const [historyLoading, setHistoryLoading] = useState(true);
	const [openingChatId, setOpeningChatId] = useState<number | null>(null);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loggingOut, setLoggingOut] = useState(false);

	useEffect(() => {
		let active = true;
		void Promise.allSettled([currentCalendar(), listChats()]).then(([calendarResult, chatResult]) => {
			if (!active) {
				return;
			}
			if (calendarResult.status === 'fulfilled') {
				setTermLabel(calendarLabel(calendarResult.value));
				setTermId(calendarResult.value.academicTerm?.id ?? null);
			} else {
				setError(calendarResult.reason instanceof ApiError ? calendarResult.reason.message : 'Unable to load the calendar.');
			}
			if (chatResult.status === 'fulfilled') {
				setChats(chatResult.value.chats);
			} else {
				setError(chatResult.reason instanceof ApiError ? chatResult.reason.message : 'Unable to load chat history.');
			}
			setInitialLoading(false);
			setHistoryLoading(false);
		});
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!termId) {
			setCourses([]);
			setCourseId(null);
			setClassLabel(null);
			setCoursesLoading(false);
			return;
		}
		let active = true;
		setCoursesLoading(true);
		studentCourses(termId)
			.then((result) => {
				if (active) {
					setClassLabel(result.classLabel);
					setCourses(result.courses);
					setCourseId((current) => result.courses.some((course) => course.id === current) ? current : null);
				}
			})
			.catch((caught: unknown) => {
				if (active) {
					setCourses([]);
					setCourseId(null);
					setError(caught instanceof ApiError ? caught.message : 'Unable to load eligible courses.');
				}
			})
			.finally(() => {
				if (active) {
					setCoursesLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [termId]);

	useEffect(() => {
		if (!termId || !courseId) {
			setMaterials([]);
			setMaterialsLoading(false);
			return;
		}
		let active = true;
		setMaterials([]);
		setMaterialsLoading(true);
		studentCourseMaterials(courseId, termId)
			.then((result) => {
				if (active) {
					setMaterials(result.materials);
				}
			})
			.catch((caught: unknown) => {
				if (active) {
					setMaterials([]);
					setError(caught instanceof ApiError ? caught.message : 'Unable to load course materials.');
				}
			})
			.finally(() => {
				if (active) {
					setMaterialsLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [courseId, termId]);

	function startNewChat() {
		if (sending || openingChatId !== null) {
			return;
		}
		setActiveChat(null);
		setMessages([]);
		setCourseId(null);
		setDraft('');
		setError(null);
	}

	async function openChat(chatId: number) {
		if (sending || openingChatId !== null) {
			return;
		}
		setOpeningChatId(chatId);
		setError(null);
		try {
			const result = await getChat(chatId);
			setActiveChat(result.chat);
			setMessages(result.messages);
			setDraft('');
		} catch (caught) {
			setError(caught instanceof ApiError ? caught.message : 'Unable to open that chat.');
		} finally {
			setOpeningChatId(null);
		}
	}

	async function onSend(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const question = draft.trim();
		if (!question || sending) {
			return;
		}
		if (!activeChat && (!termId || !courseId)) {
			setError('Choose an eligible course before starting a conversation.');
			return;
		}

		setSending(true);
		setError(null);
		const optimistic: ChatMessage = {
			id: Date.now(),
			role: 'USER',
			content: question,
			sources: [],
			createdAt: new Date().toISOString(),
		};
		setMessages((current) => [...current, optimistic]);
		setDraft('');
		try {
			let chat = activeChat;
			if (!chat) {
				chat = await createChat(courseId!, termId!);
				setActiveChat(chat);
				setChats((current) => [chat!, ...current.filter((item) => item.id !== chat!.id)]);
			}
			const result = await sendChatMessage(chat.id, question);
			setActiveChat(result.chat);
			setMessages((current) => [...current, result.message]);
			setChats((current) => [result.chat, ...current.filter((item) => item.id !== result.chat.id)]);
		} catch (caught) {
			setMessages((current) => current.filter((item) => item.id !== optimistic.id));
			setDraft(question);
			setError(caught instanceof ApiError ? caught.message : 'Unable to send that question.');
		} finally {
			setSending(false);
		}
	}

	async function onLogout() {
		setLoggingOut(true);
		try {
			await logout();
			navigate('/login');
		} catch {
			setError('Could not log out. Try again.');
			setLoggingOut(false);
		}
	}

	const selectedCourse = courses.find((course) => course.id === courseId);
	const visibleCourses = courses.filter((course) =>
		`${course.code} ${course.name}`.toLowerCase().includes(courseSearch.trim().toLowerCase()),
	);
	const canCompose = Boolean(activeChat || (termId && courseId));

	return (
		<div className="chat-shell assistant-workspace">
			<aside className="chat-list">
				<div className="assistant-brand">
					<span className="assistant-brand-mark" aria-hidden="true">C</span>
					<div><strong>Campus</strong><span>LEARNING ASSISTANT</span></div>
				</div>
				<button
					className="button chat-new"
					type="button"
					onClick={startNewChat}
					disabled={sending || openingChatId !== null}
				>
					<span className="new-chat-plus" aria-hidden="true">+</span> New conversation
				</button>
				<div className="history-heading"><span>RECENT</span><i /></div>
				<div className="chat-history" aria-label="Previous conversations">
					{historyLoading ? <p className="status">Loading conversations...</p> : null}
					{!historyLoading && chats.length === 0 ? <p className="history-empty">Your course conversations<br />will appear here.</p> : null}
					{chats.map((chat) => (
						<button
							key={chat.id}
							type="button"
							className={activeChat?.id === chat.id ? 'chat-link active' : 'chat-link'}
							onClick={() => void openChat(chat.id)}
							disabled={sending || openingChatId !== null}
							aria-current={activeChat?.id === chat.id ? 'page' : undefined}
						>
							<span className="chat-link-course">{chat.courseName}</span>
							<strong>{chat.title}</strong>
						</button>
					))}
				</div>
				<div className="assistant-rail-footer"><span className="rail-avatar">{user?.email.slice(0, 1).toUpperCase()}</span><span>Private course workspace</span></div>
			</aside>
			<section className="chat-main">
				<header className="assistant-topbar">
					<div className="assistant-class-context">
						<span className="class-context-mark" aria-hidden="true">{classLabel?.slice(0, 1) ?? 'C'}</span>
						<div><strong>{classLabel ?? 'Student workspace'}</strong><span>{termLabel || 'Academic calendar unavailable'}</span></div>
					</div>
					<div className="assistant-account">
						<span className="account-email">{user?.email}</span>
						<button className="assistant-logout" type="button" onClick={() => void onLogout()} disabled={loggingOut}>
							{loggingOut ? 'Signing out...' : 'Log out'}
						</button>
					</div>
				</header>
				<div className="chat-course assistant-course-bar">
					{activeChat ? (
						<div className="active-course-lockup">
							<span className="active-course-mark" aria-hidden="true">{activeChat.courseName.slice(0, 1)}</span>
							<div><span>CONVERSATION COURSE</span><strong>{activeChat.courseName}</strong></div>
							<span className="course-fixed-tag">FIXED</span>
						</div>
					) : (
						<div className="new-chat-context">
							<span className="new-chat-context-mark" aria-hidden="true">{courseId ? selectedCourse?.code.slice(0, 1) : '+'}</span>
							<div>
								<span>{courseId ? 'COURSE SELECTED' : 'NEW CONVERSATION'}</span>
								<strong>{coursesLoading ? 'Finding your courses...' : selectedCourse?.name ?? 'Choose a course to begin'}</strong>
							</div>
							{courseId ? <span className="course-fixed-tag">READY</span> : null}
						</div>
					)}
				</div>
				<div className="chat-transcript" aria-live="polite">
					{error ? <Alert message={error} /> : null}
					{initialLoading ? <p className="status">Loading your assistant...</p> : null}
					{!initialLoading && !activeChat && !termId ? (
						<p className="chat-empty">There is no active academic term for a new conversation. You can still reopen a previous chat.</p>
					) : null}
					{!initialLoading && !activeChat && termId && !coursesLoading && courses.length === 0 ? (
						<p className="chat-empty">No faculty-published materials are available for this academic term yet.</p>
					) : null}
					{!initialLoading && coursesLoading && !activeChat ? <p className="course-loading" role="status">Finding published course materials...</p> : null}
					{!initialLoading && !activeChat && termId && courses.length > 0 && !courseId ? (
						<section className="assistant-welcome course-library-picker">
							<div className="course-picker-heading">
								<div>
									<p className="welcome-overline">FACULTY-PUBLISHED LIBRARY</p>
									<h1>Choose a<br /><em>course to explore.</em></h1>
									<p>Browse course notes published for {termLabel || 'the current term'}.</p>
								</div>
								<div className="course-library-summary" aria-label={`${courses.length} courses available`}>
									<strong>{courses.length.toString().padStart(2, '0')}</strong>
									<span>COURSES<br />WITH NOTES</span>
								</div>
							</div>
							<label className="course-search">
								<span>Find a course</span>
								<input
									type="search"
									value={courseSearch}
									onChange={(event) => setCourseSearch(event.target.value)}
									placeholder="Search by course code or name"
									aria-label="Search courses by code or name"
								/>
							</label>
							<div className="course-choice-grid" aria-label="Courses with published materials">
								{visibleCourses.map((course, index) => (
									<button
										key={course.id}
										type="button"
										className={`course-choice-card course-choice-${index % 4}`}
										onClick={() => {
											setCourseId(course.id);
											setError(null);
										}}
									>
										<span className="course-choice-mark" aria-hidden="true">{course.code.slice(0, 1)}</span>
										<span className="course-choice-copy"><small>{course.code}</small><strong>{course.name}</strong></span>
										<span className="course-material-count">{course.materialCount} {course.materialCount === 1 ? 'note' : 'notes'}</span>
									</button>
								))}
								{visibleCourses.length === 0 ? <p className="course-search-empty">No courses match “{courseSearch}”.</p> : null}
							</div>
						</section>
					) : null}
					{!initialLoading && !activeChat && termId && courseId ? (
						<div className="assistant-welcome assistant-welcome-selected">
							<span className="welcome-stamp" aria-hidden="true">{selectedCourse?.code.slice(0, 1) ?? 'C'}</span>
							<p className="welcome-overline">{selectedCourse?.code} · COURSE ASSISTANT</p>
							<button className="course-picker-back" type="button" onClick={() => setCourseId(null)}>← All courses</button>
							<h1>What are you<br /><em>working through?</em></h1>
							<p>Questions are answered from the materials shared for {selectedCourse?.name}.</p>
							<div className="starter-prompts">
								<button type="button" onClick={() => setDraft('Explain a key concept from the course materials.')}>Explain a key concept <span>↗</span></button>
								<button type="button" onClick={() => setDraft('Summarize the main ideas in the course notes.')}>Summarize the notes <span>↗</span></button>
							</div>
							<section className="student-materials" aria-label="Course materials">
								<header><h2>Course materials</h2><span>{materialsLoading ? 'Loading' : materials.length}</span></header>
								{materialsLoading ? <p className="student-materials-empty">Loading published materials...</p> : null}
								{!materialsLoading && materials.length === 0 ? (
									<p className="student-materials-empty">No published materials for this course yet.</p>
								) : null}
								{materials.length > 0 ? (
									<ul>
										{materials.map((material) => (
											<li key={material.id}>
												<span className="student-material-file" aria-hidden="true">PDF</span>
												<span><strong>{material.title}</strong><small>{material.pageCount === null ? material.originalFilename : `${material.pageCount} pages`}</small></span>
											</li>
										))}
									</ul>
								) : null}
							</section>
						</div>
					) : null}
					{activeChat && messages.length === 0 ? (
						<p className="chat-empty">Ask a question about {activeChat.courseName} materials.</p>
					) : null}
					{messages.map((message) => (
						<article key={message.id} className={message.role === 'USER' ? 'chat-row user' : 'chat-row assistant'}>
							<div className={message.role === 'USER' ? 'chat-bubble user' : 'chat-bubble assistant'}>
								<p className="chat-speaker">{message.role === 'USER' ? 'You' : 'Campus Assistant'}</p>
								{message.role === 'ASSISTANT' ? (
									<div className="answer-markdown">
										<ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
											{message.content}
										</ReactMarkdown>
									</div>
								) : <p>{message.content}</p>}
								{message.sources.length > 0 ? (
									<ul className="chat-sources" aria-label="Sources">
										{message.sources.map((source) => (
											<li key={`${source.documentId}-${source.pageNumber ?? 'na'}`}>
												{source.title}{source.pageNumber !== null ? ` · page ${source.pageNumber}` : ''}
											</li>
										))}
									</ul>
								) : null}
							</div>
						</article>
					))}
					{sending ? <p className="status" role="status">Searching course materials...</p> : null}
					{openingChatId !== null ? <p className="status" role="status">Opening conversation...</p> : null}
				</div>
				<form className="chat-composer" onSubmit={(event) => void onSend(event)}>
					<span className="composer-course-dot" aria-hidden="true" />
					<input
						name="question"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder={activeChat || selectedCourse ? 'Ask about this course...' : 'Choose a course to begin...'}
						maxLength={2000}
						disabled={!canCompose || sending || openingChatId !== null}
						aria-label="Your question"
					/>
					<button className="button" type="submit" disabled={!canCompose || sending || !draft.trim() || openingChatId !== null}>
						{sending ? 'Sending...' : 'Send'}
					</button>
				</form>
			</section>
		</div>
	);
}
