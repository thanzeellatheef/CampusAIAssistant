import { useEffect, useState, type FormEvent } from 'react';
import {
	currentCalendar,
	deleteCourseDocument,
	listCourseDocuments,
	listTeachingCourses,
	uploadCourseDocument,
	type CourseDocument,
	type TeachingCourse,
} from '../../api/materials';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/common/Alert';
import { calendarLabel } from '../../components/layout/calendar-label';

export function FacultyHomePage() {
	const [termId, setTermId] = useState<number | null>(null);
	const [termLabel, setTermLabel] = useState('No active term');
	const [courses, setCourses] = useState<TeachingCourse[]>([]);
	const [courseId, setCourseId] = useState<number | null>(null);
	const [documents, setDocuments] = useState<CourseDocument[]>([]);
	const [title, setTitle] = useState('');
	const [selectedFilename, setSelectedFilename] = useState('');
	const [loading, setLoading] = useState(true);
	const [documentsLoading, setDocumentsLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
	const [confirmDeleteDocumentId, setConfirmDeleteDocumentId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		currentCalendar()
			.then((calendar) => {
				if (active) {
					setTermLabel(calendarLabel(calendar));
					setTermId(calendar.academicTerm?.id ?? null);
				}
			})
			.catch((caught: unknown) => {
				if (active) {
					setError(caught instanceof ApiError ? caught.message : 'Unable to load the calendar.');
					setLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!termId) {
			setCourses([]);
			setCourseId(null);
			setLoading(false);
			return;
		}
		let active = true;
		setLoading(true);
		listTeachingCourses(termId)
			.then((result) => {
				if (active) {
					setCourses(result.courses);
					setCourseId((current) => result.courses.some((course) => course.id === current)
						? current
						: result.courses[0]?.id ?? null);
				}
			})
			.catch((caught: unknown) => {
				if (active) {
					setCourses([]);
					setCourseId(null);
					setError(caught instanceof ApiError ? caught.message : 'Unable to load courses.');
				}
			})
			.finally(() => {
				if (active) {
					setLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [termId]);

	useEffect(() => {
		if (!termId || !courseId) {
			setDocuments([]);
			setDocumentsLoading(false);
			return;
		}
		let active = true;
		setDocuments([]);
		setDocumentsLoading(true);
		listCourseDocuments(courseId, termId)
			.then((result) => {
				if (active) {
					setDocuments(result.documents);
				}
			})
			.catch((caught: unknown) => {
				if (active) {
					setError(caught instanceof ApiError ? caught.message : 'Unable to load documents.');
				}
			})
			.finally(() => {
				if (active) {
					setDocumentsLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [courseId, termId]);

	async function onUpload(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!termId || !courseId) {
			return;
		}
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			setError('Choose a PDF file.');
			return;
		}
		setUploading(true);
		setError(null);
		setNotice(null);
		try {
			const result = await uploadCourseDocument(courseId, termId, title, file);
			const { document } = result;
			setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
			setTitle('');
			formElement.reset();
			setSelectedFilename('');
			if (result.duplicate) {
				setNotice('This PDF is already uploaded for this course and term. The existing document is shown below.');
			} else if (document.status === 'READY') {
				setNotice('The PDF is ready for questions.');
			} else {
				setError(document.errorMessage || 'The PDF could not be processed.');
			}
		} catch (caught) {
			setError(caught instanceof ApiError ? caught.message : 'Unable to upload the PDF.');
		} finally {
			setUploading(false);
		}
	}

	async function onDelete(document: CourseDocument) {
		if (confirmDeleteDocumentId !== document.id || deletingDocumentId !== null) {
			setConfirmDeleteDocumentId(document.id);
			return;
		}
		setDeletingDocumentId(document.id);
		setError(null);
		setNotice(null);
		try {
			await deleteCourseDocument(document.id);
			setDocuments((current) => current.filter((item) => item.id !== document.id));
			setNotice(`Removed “${document.title}” and its indexed chunks.`);
		} catch (caught) {
			setError(caught instanceof ApiError ? caught.message : 'Unable to delete this document.');
		} finally {
			setDeletingDocumentId(null);
			setConfirmDeleteDocumentId(null);
		}
	}

	const selectedCourse = courses.find((course) => course.id === courseId);
	const readyCount = documents.filter((document) => document.status === 'READY').length;

	return (
		<section className="page page-wide faculty-page">
			<header className="faculty-hero">
				<div className="faculty-hero-copy">
					<p className="faculty-kicker"><span className="faculty-kicker-dot" /> FACULTY LIBRARY</p>
					<h1>Build your<br /><em>course library.</em></h1>
					<p className="faculty-hero-description">Add learning materials and make them ready for course-aware answers.</p>
				</div>
				{selectedCourse ? (
					<div className="faculty-hero-course">
						<span className="faculty-hero-orbit" aria-hidden="true">{selectedCourse.code.slice(0, 2)}</span>
						<div className="faculty-hero-course-copy">
							<span>NOW MANAGING</span>
							<strong>{selectedCourse.code}</strong>
							<p>{selectedCourse.name}</p>
							<small>{termLabel}</small>
						</div>
					</div>
				) : null}
			</header>
			{error ? <Alert message={error} /> : null}
			{notice ? <Alert message={notice} tone="success" /> : null}
			{loading ? <p className="status" role="status">Loading assigned courses...</p> : null}
			{!loading && !termId ? <p className="muted">There is no active academic term.</p> : null}
			{!loading && termId && courses.length === 0 ? <p className="muted">No courses are assigned to you for this term.</p> : null}
			{selectedCourse && termId ? (
				<>
					<div className="faculty-stats" aria-label="Library summary">
						<div className="faculty-stat faculty-stat-course">
							<span>COURSE</span>
							<strong>{selectedCourse.code}</strong>
							<small>{selectedCourse.name}</small>
						</div>
						<div className="faculty-stat faculty-stat-total">
							<span>LIBRARY</span>
							<strong>{documents.length.toString().padStart(2, '0')}</strong>
							<small>materials uploaded</small>
						</div>
						<div className="faculty-stat faculty-stat-ready">
							<span>READY FOR STUDENTS</span>
							<strong>{readyCount.toString().padStart(2, '0')}</strong>
							<small>indexed materials</small>
						</div>
					</div>
					<form className="material-upload-panel" onSubmit={onUpload}>
						<div className="upload-panel-heading">
							<div className="upload-title-lockup">
								<span className="upload-spark" aria-hidden="true">+</span>
								<div>
									<p className="upload-overline">GROW THE LIBRARY</p>
									<h2>Add a learning material</h2>
								</div>
							</div>
							<p>PDFs become searchable context for student questions.</p>
						</div>
						<label className="field upload-field-course">
							<span>Course destination</span>
							<select
								name="courseId"
								value={courseId ?? ''}
								onChange={(event) => {
									setCourseId(Number(event.target.value));
									setError(null);
									setNotice(null);
								}}
							>
								{courses.map((course) => (
									<option key={course.id} value={course.id}>
										{course.code} · {course.name}
									</option>
								))}
							</select>
						</label>
						<label className="field">
							<span>Material title</span>
							<input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} />
						</label>
						<label className="pdf-dropzone">
							<span className="pdf-stamp">PDF</span>
							<span className="pdf-prompt">
								<strong>{selectedFilename || 'Choose a PDF to add'}</strong>
								<small>{selectedFilename ? 'Ready to upload · stored privately' : 'PDF format · stored privately · select a file to continue'}</small>
							</span>
							<span className="pdf-browse">Browse files</span>
							<input
								name="file"
								type="file"
								accept="application/pdf,.pdf"
								required
								onChange={(event) => setSelectedFilename(event.target.files?.[0]?.name ?? '')}
							/>
						</label>
						<button className="upload-submit" type="submit" disabled={uploading || !title.trim()}>
							{uploading ? 'Indexing material...' : 'Add to library'}
							<span aria-hidden="true">↗</span>
						</button>
					</form>
					<section className="materials-library">
						<header className="materials-library-header">
							<div>
								<p className="upload-overline">YOUR COLLECTION</p>
								<h2>Course materials <span>{documents.length}</span></h2>
							</div>
							<label className="library-course-select">
								<span>Viewing</span>
								<select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value))}>
									{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
								</select>
							</label>
						</header>
						{documentsLoading ? <div className="library-state">Gathering your materials...</div> : null}
						{!documentsLoading && documents.length === 0 ? (
							<div className="library-empty">
								<span className="empty-file-mark">PDF</span>
								<div><strong>A clear shelf, ready for a first upload.</strong><p>Add a course PDF to start building this collection.</p></div>
							</div>
						) : null}
						{documents.map((document, index) => (
							<article className="material-row" key={document.id}>
								<span className={`material-index material-index-${index % 4}`} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
								<span className="material-file-mark">PDF</span>
								<div className="material-info">
									<strong>{document.title}</strong>
									<span>{document.originalFilename} <i /> {document.pageCount ?? '—'} pages</span>
									{document.status === 'FAILED' && document.errorMessage ? <small className="material-error">{document.errorMessage}</small> : null}
								</div>
								<span className={`material-state material-state-${document.status.toLowerCase()}`}>
									<span />{document.status === 'READY' ? 'Ready' : document.status === 'FAILED' ? 'Needs attention' : document.status.toLowerCase()}
								</span>
								{confirmDeleteDocumentId === document.id ? (
									<div className="material-delete-confirm">
										<span>Remove?</span>
										<button className="material-action-delete" type="button" onClick={() => void onDelete(document)} disabled={deletingDocumentId !== null}>
											{deletingDocumentId === document.id ? 'Removing...' : 'Confirm'}
										</button>
										<button className="material-action-cancel" type="button" onClick={() => setConfirmDeleteDocumentId(null)} disabled={deletingDocumentId !== null}>Cancel</button>
									</div>
								) : (
									<button
										className="material-remove"
										type="button"
										onClick={() => setConfirmDeleteDocumentId(document.id)}
										disabled={deletingDocumentId !== null || document.status === 'PROCESSING'}
										aria-label={`Delete ${document.title}`}
										title={document.status === 'PROCESSING' ? 'Wait for processing to finish' : 'Remove PDF'}
									>
										<span aria-hidden="true">×</span>
									</button>
								)}
							</article>
						))}
					</section>
				</>
			) : null}
		</section>
	);
}
