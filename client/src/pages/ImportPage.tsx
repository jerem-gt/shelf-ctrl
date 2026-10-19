import type { ImportIssue, ImportJob, ImportPreview } from '@shelfctrl/types';
import { Download } from 'lucide-react';
import { type ChangeEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { api, ApiError } from '@/api/client';
import { useImportJob, usePreviewImport, useStartImport } from '@/hooks/useImport';

const BUTTON_CLASS =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60';
const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60';
/** Au-delà, la liste des lignes à corriger est tronquée : le fichier se corrige par morceaux. */
const MAX_LISTED_PROBLEMS = 50;
const KNOWN_ERROR_CODES = new Set(['empty_file', 'no_columns', 'too_many_rows', 'import_running']);

interface ListedRow {
  line: number;
  title: string | null;
  issues: ImportIssue[];
}

/** Message d'une erreur d'envoi : le code du serveur d'abord, puis la taille, sinon le texte par défaut. */
function useErrorMessage() {
  const { t } = useTranslation();
  return (error: Error): string => {
    if (error instanceof ApiError) {
      if (error.code !== null && KNOWN_ERROR_CODES.has(error.code)) {
        return t(`import.errors.${error.code}`);
      }
      if (error.status === 413) {
        return t('import.errors.too_large');
      }
    }
    return error.message;
  };
}

function IssueText({ issue }: Readonly<{ issue: ImportIssue }>) {
  const { t } = useTranslation();
  const message = t(`import.issues.${issue.code}`);
  if (issue.field === null) {
    return <>{message}</>;
  }
  return <>{t('import.issueLine', { message, field: t(`import.fields.${issue.field}`) })}</>;
}

/** Lignes avec leurs problèmes, une par ligne de tableur. */
function IssueList({ rows, label }: Readonly<{ rows: ListedRow[]; label: string }>) {
  const { t } = useTranslation();
  return (
    <ul
      aria-label={label}
      className="flex flex-col divide-y divide-slate-200 rounded-md border border-slate-200 bg-white"
    >
      {rows.map((row) => (
        <li key={row.line} className="flex flex-col gap-0.5 p-3 text-sm">
          <p className="font-medium">
            {t('import.line', { line: row.line })} · {row.title ?? t('import.untitled')}
          </p>
          {row.issues.map((issue) => (
            <p key={`${issue.code}-${issue.field}`} className="text-red-700">
              <IssueText issue={issue} />
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function PreviewSummary({ preview }: Readonly<{ preview: ImportPreview }>) {
  const { t } = useTranslation();
  const problems = preview.rows.filter((row) => row.issues.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        {t('import.summary', {
          total: preview.total,
          valid: preview.valid,
          invalid: preview.invalid,
        })}
      </p>
      {preview.toComplete > 0 && (
        <p className="text-sm text-slate-600">
          {t('import.toComplete', { count: preview.toComplete })}
        </p>
      )}
      {preview.duplicates > 0 && (
        <p className="text-sm text-slate-600">
          {t('import.duplicates', { count: preview.duplicates })}
        </p>
      )}
      {preview.ignoredColumns.length > 0 && (
        <p className="text-sm text-slate-600">
          {t('import.ignoredColumns', { columns: preview.ignoredColumns.join(', ') })}
        </p>
      )}
      {problems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">{t('import.problems')}</h3>
          <p className="text-sm text-slate-600">{t('import.problemsHint')}</p>
          <IssueList rows={problems.slice(0, MAX_LISTED_PROBLEMS)} label={t('import.problems')} />
          {problems.length > MAX_LISTED_PROBLEMS && (
            <p className="text-sm text-slate-600">
              {t('import.moreProblems', { count: problems.length - MAX_LISTED_PROBLEMS })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function ImportUpload({ onStarted }: Readonly<{ onStarted: (jobId: string) => void }>) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const inputId = useId();
  const [file, setFile] = useState<Blob | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const preview = usePreviewImport();
  const start = useStartImport();

  /**
   * Lit le fichier en mémoire une fois pour toutes : l'aperçu et l'import portent sur le même
   * contenu, même si le fichier est corrigé sur le disque entre-temps (le navigateur refuserait
   * alors l'envoi, ou enverrait autre chose que ce qui a été contrôlé).
   */
  const load = async (chosen: File) => {
    start.reset();
    setUnreadable(false);
    try {
      const content = new Blob([await chosen.arrayBuffer()], { type: chosen.type });
      setFile(content);
      preview.mutate(content);
    } catch {
      setFile(null);
      setUnreadable(true);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    // Réinitialise le champ pour pouvoir recharger le même fichier après l'avoir corrigé.
    event.target.value = '';
    if (chosen) {
      void load(chosen);
    }
  };

  const error = preview.error ?? start.error;
  const summary = preview.data;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">{t('import.intro')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={api.import.templateUrl}
          download
          className={`${BUTTON_CLASS} inline-flex items-center gap-1`}
        >
          <Download aria-hidden className="size-4" />
          {t('import.template')}
        </a>
        <label htmlFor={inputId} className={`${PRIMARY_BUTTON_CLASS} cursor-pointer`}>
          {t(file ? 'import.chooseAnother' : 'import.choose')}
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv,text/plain,application/vnd.ms-excel"
            onChange={handleChange}
            className="sr-only"
          />
        </label>
      </div>

      {preview.isPending && <p className="text-sm text-slate-500">{t('import.analyzing')}</p>}
      {unreadable && (
        <p role="alert" className="text-sm text-red-700">
          {t('import.errors.unreadable')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(error)}
        </p>
      )}
      {summary && <PreviewSummary preview={summary} />}
      {summary && file && (
        <div>
          {summary.valid > 0 ? (
            <button
              type="button"
              disabled={start.isPending}
              onClick={() => start.mutate(file, { onSuccess: (job) => onStarted(job.id) })}
              className={PRIMARY_BUTTON_CLASS}
            >
              {start.isPending ? t('import.starting') : t('import.start', { count: summary.valid })}
            </button>
          ) : (
            <p className="text-sm text-slate-600">{t('import.nothingToImport')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function JobReport({ job }: Readonly<{ job: ImportJob }>) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className={job.status === 'failed' ? 'text-sm text-red-700' : 'text-sm font-medium'}>
        {t(job.status === 'failed' ? 'import.failed' : 'import.done')}
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        <li>{t('import.created', { count: job.created })}</li>
        {job.completed > 0 && <li>{t('import.completed', { count: job.completed })}</li>}
        {job.coversFound > 0 && <li>{t('import.covers', { count: job.coversFound })}</li>}
      </ul>
      {job.failures.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">{t('import.failures')}</h3>
          <IssueList rows={job.failures} label={t('import.failures')} />
        </section>
      )}
    </div>
  );
}

function ImportProgress({ jobId, onNew }: Readonly<{ jobId: string; onNew: () => void }>) {
  const { t } = useTranslation();
  const { data: job, error } = useImportJob(jobId);
  const finished = job !== undefined && job.status !== 'running';

  let body;
  if (error) {
    const unknown = error instanceof ApiError && error.status === 404;
    body = (
      <p role="alert" className="text-sm text-red-700">
        {unknown ? t('import.notFound') : error.message}
      </p>
    );
  } else if (!job) {
    body = <p className="text-sm text-slate-500">{t('collection.loading')}</p>;
  } else if (job.status === 'running') {
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          {t('import.progress', { processed: job.processed, total: job.total })}
        </p>
        <progress
          aria-label={t('import.progressLabel')}
          value={job.processed}
          max={job.total}
          className="w-full"
        />
      </div>
    );
  } else {
    body = <JobReport job={job} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {body}
      {(finished || error) && (
        <div className="flex flex-wrap gap-3">
          <Link to="/" className={PRIMARY_BUTTON_CLASS}>
            {t('import.viewCollection')}
          </Link>
          <button type="button" onClick={onNew} className={BUTTON_CLASS}>
            {t('import.newImport')}
          </button>
        </div>
      )}
    </div>
  );
}

export function ImportPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  // L'identifiant de l'import est dans l'adresse : recharger la page ou revenir en arrière le retrouve.
  const jobId = params.get('job');

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t('import.title')}</h2>
      {jobId ? (
        <ImportProgress jobId={jobId} onNew={() => setParams({})} />
      ) : (
        <ImportUpload onStarted={(id) => setParams({ job: id })} />
      )}
    </section>
  );
}
