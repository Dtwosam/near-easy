import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './icons';
import type { IconName } from './icons';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title === 'NEAR Easy' ? title : `${title} · NEAR Easy`;
  }, [title]);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
};

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`btn btn-${variant} btn-${size} ${className}`.trim()} {...props} />;
}

export function Badge({ tone = 'muted', children }: { tone?: 'accent' | 'muted' | 'demo' | 'danger' | 'warn'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Capability({ ready, chain }: { ready: string; chain: string }) {
  return (
    <div className="capability">
      <span className="cap cap-ready">{ready}</span>
      <span className="cap cap-chain">{chain}</span>
    </div>
  );
}

export function Help({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="help">
      <summary>{title}</summary>
      <div className="help-body">{children}</div>
    </details>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

export function ActionCard({
  icon,
  title,
  body,
  badge,
  to,
  onClick,
}: {
  icon: IconName;
  title: string;
  body: string;
  badge?: ReactNode;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="qa-top">
        <span className="qa-icon">
          <Icon name={icon} />
        </span>
        {badge}
      </span>
      <strong>{title}</strong>
      <span className="qa-copy">{body}</span>
      <em className="qa-arrow" aria-hidden="true">
        <Icon name="arrow" size={16} />
      </em>
    </>
  );
  if (to) return <Link to={to} className="qa">{inner}</Link>;
  return (
    <button type="button" className="qa" onClick={onClick}>
      {inner}
    </button>
  );
}

export function EmptyState({ icon = 'info', title, body, action }: { icon?: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    const previously = document.activeElement as HTMLElement | null;
    const nodes = () =>
      root
        ? [...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
            (node) => !node.hasAttribute('disabled'),
          )
        : [];
    nodes()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (document.querySelector('.hot-connector-popup')) return;
        onCloseRef.current();
      }
      if (event.key !== 'Tab') return;
      const list = nodes();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previously?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-root" onMouseDown={() => onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        if (!ok) throw new Error('copy failed');
      }
      setState('done');
    } catch {
      setState('error');
    }
    window.setTimeout(() => setState('idle'), 1600);
  }
  return (
    <button type="button" className="copy-btn" onClick={copy} aria-label={label}>
      <Icon name={state === 'done' ? 'check' : 'copy'} size={16} />
      <span>{state === 'done' ? 'Copied' : state === 'error' ? 'Copy failed' : label}</span>
    </button>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TxTable({ rows }: { rows: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="tx-table">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>
            {row.value}
            {row.hint ? <small>{row.hint}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RouteVisual({
  fromSymbol,
  fromLabel,
  fromAmount,
  toAmount,
  toSymbol = 'NEAR',
  toLabel = 'NEAR',
}: {
  fromSymbol: string;
  fromLabel: string;
  fromAmount: string;
  toAmount: string;
  toSymbol?: string;
  toLabel?: string;
}) {
  return (
    <div className="route" aria-label={`${fromAmount} ${fromLabel} to ${toLabel}. ${toAmount}`}>
      <div className="route-end">
        <span className="token-badge">{fromSymbol.slice(0, 4)}</span>
        <div>
          <strong>{fromLabel}</strong>
          <em>{fromAmount}</em>
        </div>
      </div>
      <span className="route-arrow" aria-hidden="true">
        <Icon name="arrow" />
      </span>
      <div className="route-end">
        <span className="token-badge near">{toSymbol.slice(0, 4)}</span>
        <div>
          <strong>{toLabel}</strong>
          <em>{toAmount}</em>
        </div>
      </div>
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'on' : '';
        return (
          <li key={step} className={state} aria-current={index === current ? 'step' : undefined}>
            <span>{index < current ? <Icon name="check" size={14} /> : index + 1}</span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}

export function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const labelId = useId();
  return (
    <div className="field">
      <span id={labelId}>{label}</span>
      <div role="radiogroup" aria-labelledby={labelId} className="choices">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            className={value === option ? 'choice on' : 'choice'}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
