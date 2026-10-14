import type { CopyItem } from '@shelfctrl/types';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { DeleteCopyConfirmation } from '@/components/DeleteCopyConfirmation';
import { EditCopyForm } from '@/components/EditCopyForm';
import { LoanSection } from '@/components/LoanSection';
import { SaleSection } from '@/components/SaleSection';
import { StatusBadge } from '@/components/StatusBadge';
import { useCopy } from '@/hooks/useCopies';
import { formatDate } from '@/lib/format';

type Mode = 'view' | 'edit' | 'delete';

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-600">
      <ArrowLeft aria-hidden className="size-4" />
      {t('detail.back')}
    </Link>
  );
}

function DetailItem({ label, value }: Readonly<{ label: string; value: string | null }>) {
  const { t } = useTranslation();
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value ?? t('detail.noValue')}</dd>
    </div>
  );
}

function CopyDetails({ copy }: Readonly<{ copy: CopyItem }>) {
  const { t } = useTranslation();
  const { work, edition } = copy;

  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      <DetailItem label={t('detail.format')} value={t(`formats.${edition.format}`)} />
      <DetailItem label={t('detail.barcode')} value={edition.barcode} />
      <DetailItem label={t('detail.publisher')} value={edition.publisher} />
      <DetailItem label={t('detail.creators')} value={work.creators} />
      <DetailItem label={t('detail.condition')} value={t(`conditions.${copy.condition}`)} />
      <DetailItem label={t('detail.conditionNote')} value={copy.conditionNote} />
      <DetailItem label={t('detail.location')} value={copy.location} />
      <DetailItem label={t('detail.addedOn')} value={formatDate(copy.createdAt)} />
    </dl>
  );
}

export function CopyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const copyId = Number(useParams().id);
  const { data: copy, error, isPending } = useCopy(copyId);
  const [mode, setMode] = useState<Mode>('view');

  if (error) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <section className="flex flex-col gap-4">
        <BackLink />
        <p role="alert" className="text-red-700">
          {missing ? t('detail.notFound') : error.message}
        </p>
      </section>
    );
  }
  if (isPending) {
    return <p className="text-slate-500">{t('collection.loading')}</p>;
  }

  const { work } = copy;
  let body;
  if (mode === 'edit') {
    body = <EditCopyForm copy={copy} onDone={() => setMode('view')} />;
  } else if (mode === 'delete') {
    body = (
      <DeleteCopyConfirmation
        copyId={copy.id}
        onCancel={() => setMode('view')}
        onDeleted={() => void navigate('/')}
      />
    );
  } else {
    body = (
      <>
        <CopyDetails copy={copy} />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="flex items-center gap-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            <Pencil aria-hidden className="size-4" />
            {t('detail.edit')}
          </button>
          <button
            type="button"
            onClick={() => setMode('delete')}
            className="flex items-center gap-1 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700"
          >
            <Trash2 aria-hidden className="size-4" />
            {t('detail.delete')}
          </button>
        </div>
        <LoanSection copy={copy} />
        <SaleSection copy={copy} />
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <BackLink />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{work.title}</h2>
          {work.series && (
            <p className="text-sm text-slate-600">
              {work.series}
              {work.volumeNumber !== null &&
                ` · ${t('collection.volume', { number: work.volumeNumber })}`}
            </p>
          )}
        </div>
        <StatusBadge status={copy.status} />
      </header>
      {body}
    </section>
  );
}
