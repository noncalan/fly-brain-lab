import { useCallback, useEffect, useState } from 'react';
import { Panel } from '../app/shell';
import { LESSONS, type Lesson, type Question } from '../content/lessons';
import { useI18n } from '../i18n';

function readLessonId(): string | null {
  const id = new URLSearchParams(window.location.search).get('l');
  return LESSONS.some((l) => l.id === id) ? id : null;
}

function writeLessonId(id: string | null): void {
  window.history.replaceState({}, '', id ? `/lessons?l=${id}` : '/lessons');
}

function QuizQuestion({ question, index, big, onAnswered }: { question: Question; index: number; big: boolean; onAnswered: (correct: boolean) => void }) {
  const { t, lang } = useI18n();
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = choice === question.answer;
  return (
    <fieldset className="space-y-2" data-testid={`quiz-q${index}`}>
      <legend className={`font-medium ${big ? 'text-2xl' : ''}`}>
        {index + 1}. {question.q[lang]}
      </legend>
      {question.options.map((o, i) => (
        <label key={i} className={`flex items-start gap-2 rounded-md border p-2 ${checked && i === question.answer ? 'border-accent' : 'border-line'} ${big ? 'text-xl' : 'text-sm'}`}>
          <input type="radio" name={`q${index}`} checked={choice === i} disabled={checked} onChange={() => setChoice(i)} className="mt-1" />
          <span>{o[lang]}</span>
        </label>
      ))}
      {!checked ? (
        <button
          type="button"
          disabled={choice === null}
          onClick={() => {
            setChecked(true);
            onAnswered(correct);
          }}
          className="rounded-md border border-line px-3 py-1 text-sm hover:border-accent disabled:opacity-40"
          data-testid={`quiz-check${index}`}
        >
          {t('les.check')}
        </button>
      ) : (
        <p className={`${correct ? 'text-accent' : 'text-warn'} ${big ? 'text-xl' : 'text-sm'}`} role="status">
          {correct ? t('les.correct') : t('les.wrong')} {question.why[lang]}
        </p>
      )}
    </fieldset>
  );
}

function LessonView({ lesson, number, onExit }: { lesson: Lesson; number: number; onExit: () => void }) {
  const { t, lang } = useI18n();
  const [pos, setPos] = useState(0); // steps, then the quiz at pos === steps.length
  const [teacher, setTeacher] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [attempt, setAttempt] = useState(0);
  const last = lesson.steps.length;
  const step = lesson.steps[pos];

  const go = useCallback((d: number) => setPos((p) => Math.max(0, Math.min(last, p + d))), [last]);
  const enterTeacher = () => {
    setTeacher(true);
    document.documentElement.requestFullscreen?.().catch(() => undefined); // the overlay works without it (iOS)
  };
  const exitTeacher = useCallback(() => {
    setTeacher(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape' && teacher) exitTeacher();
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) setTeacher(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [go, teacher, exitTeacher]);

  const big = teacher;
  return (
    <div className={teacher ? 'fixed inset-0 z-50 overflow-auto bg-bg p-6 sm:p-12' : 'mx-auto max-w-3xl space-y-4 p-4'} data-testid="lesson">
      <div className="flex flex-wrap items-center gap-2">
        {!teacher && (
          <button type="button" onClick={onExit} className="text-sm text-muted hover:text-ink">
            ← {t('les.toList')}
          </button>
        )}
        <button
          type="button"
          onClick={teacher ? exitTeacher : enterTeacher}
          aria-pressed={teacher}
          className="ml-auto rounded-md border border-line px-3 py-1 text-sm hover:border-accent"
          data-testid="teacher-toggle"
        >
          {teacher ? t('les.exitTeacher') : t('les.teacher')}
        </button>
      </div>
      <div className={teacher ? 'mx-auto mt-6 max-w-5xl' : ''}>
        <p className="text-xs uppercase tracking-wide text-muted">{t('les.lessonN', { n: number })}</p>
        <h1 className={`font-semibold ${big ? 'text-5xl' : 'text-2xl'}`}>{lesson.title[lang]}</h1>
        <div className="mt-4" aria-live="polite">
          {step ? (
            <>
              <p className="text-xs text-muted" data-testid="lesson-progress">
                {t('les.step', { i: pos + 1, n: last })}
              </p>
              <p className={`mt-2 ${big ? 'text-3xl leading-snug' : 'text-lg'}`} data-testid="lesson-step">
                {step.text[lang]}
              </p>
              {step.demo && (
                <a
                  href={step.demo}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-4 inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast ${big ? 'text-2xl' : 'text-sm'}`}
                  data-testid="lesson-demo"
                >
                  {t('les.demo')} ↗
                </a>
              )}
            </>
          ) : (
            <div className="space-y-4" key={attempt}>
              <h2 className={`font-semibold ${big ? 'text-3xl' : 'text-lg'}`}>{t('les.quiz')}</h2>
              {lesson.quiz.map((q, i) => (
                <QuizQuestion key={i} question={q} index={i} big={big} onAnswered={(ok) => setAnswers((a) => [...a, ok])} />
              ))}
              {answers.length === lesson.quiz.length && (
                <p className={`font-medium ${big ? 'text-2xl' : ''}`} data-testid="quiz-score">
                  {t('les.score', { k: answers.filter(Boolean).length, n: lesson.quiz.length })}{' '}
                  <button
                    type="button"
                    className="ml-2 text-sm text-muted underline"
                    onClick={() => {
                      setAnswers([]);
                      setAttempt((x) => x + 1);
                    }}
                  >
                    {t('les.retry')}
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center gap-2">
          <button type="button" disabled={pos === 0} onClick={() => go(-1)} className="rounded-md border border-line px-4 py-2 hover:border-accent disabled:opacity-40">
            {t('les.back')}
          </button>
          {pos < last && (
            <button type="button" onClick={() => go(1)} className="rounded-md border border-accent px-4 py-2 text-accent" data-testid="lesson-next">
              {pos === last - 1 ? t('les.toQuiz') : t('les.next')}
            </button>
          )}
          {teacher && <span className="ml-auto text-xs text-muted">{t('les.teacherHint')}</span>}
        </div>
        {!teacher && (
          <section className="mt-6 text-xs text-muted" aria-label={t('les.sources')}>
            <h2 className="font-semibold uppercase tracking-wide">{t('les.sources')}</h2>
            <ul className="mt-1 space-y-0.5">
              {lesson.sources.map((s) => (
                <li key={s.cite + (s.doi ?? s.file)}>
                  {s.doi ? (
                    <a className="underline hover:text-ink" href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer">
                      {s.cite}
                    </a>
                  ) : (
                    `${s.cite}: ${s.file}`
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export function LessonsPage() {
  const { t, lang } = useI18n();
  const [id, setId] = useState<string | null>(readLessonId);
  const open = (next: string | null) => {
    writeLessonId(next);
    setId(next);
    window.scrollTo(0, 0);
  };
  const index = LESSONS.findIndex((l) => l.id === id);
  if (index >= 0) return <LessonView key={id} lesson={LESSONS[index]} number={index + 1} onExit={() => open(null)} />;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('les.title')}</h1>
        <p className="mt-1 max-w-3xl text-muted">{t('les.intro')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LESSONS.map((l, i) => (
          <Panel key={l.id} title={t('les.lessonN', { n: i + 1 })}>
            <h2 className="text-lg font-semibold">{l.title[lang]}</h2>
            <p className="mt-1 text-sm text-muted">{l.summary[lang]}</p>
            <button type="button" onClick={() => open(l.id)} className="mt-3 rounded-md border border-accent px-3 py-1 text-sm text-accent" data-testid={`lesson-open-${l.id}`}>
              {t('les.start')}
            </button>
          </Panel>
        ))}
      </div>
    </div>
  );
}
