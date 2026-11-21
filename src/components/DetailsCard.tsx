import type { ChangeEvent } from 'react';
import type { useSignatures } from '../hooks/useSignatures';
import type { Profile } from '../lib/buildForm';
import { Icon } from './Icon';
import { SignatureField } from './SignatureField';

interface Props {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
  signatures: ReturnType<typeof useSignatures>;
  nameMissing: boolean;
}

/**
 * Who is filing, and who signs. The typed details are remembered on this
 * device (useStored) because they are the same every cutoff; signatures follow
 * their own rules in useSignatures.
 */
export function DetailsCard({ profile, onChange, signatures, nameMissing }: Props) {
  const text = (key: keyof Profile) => ({
    id: `p-${key}`,
    className: 'input',
    value: profile[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ [key]: e.target.value }),
  });

  return (
    <section className="card" aria-labelledby="details-title">
      <div className="card__head">
        <h2 className="card__title" id="details-title">
          <span className="card__step">1</span> Your details
        </h2>
        <p className="card__sub">Saved on this device, so next cutoff you only load your attendance.</p>
      </div>
      <div className="card__body stack">
        <div className="fields fields--2">
          <div className="field">
            <label className="field__label" htmlFor="p-name">
              Name <span className="field__req" aria-hidden="true">*</span>
            </label>
            <input
              {...text('name')}
              className={`input${nameMissing ? ' input--invalid' : ''}`}
              autoComplete="name"
              placeholder="Juan P. Dela Cruz"
              aria-invalid={nameMissing || undefined}
              aria-describedby={nameMissing ? 'p-name-error' : undefined}
            />
            {nameMissing && (
              <p className="field__error" id="p-name-error">
                <Icon name="alert" size={16} /> Your name goes on the form twice — add it first.
              </p>
            )}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="p-position">Position</label>
            <input {...text('position')} autoComplete="organization-title" placeholder="ITSO Assistant" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="p-department">Department</label>
            <input {...text('department')} placeholder="ITSO" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="p-superior">
              Immediate superior <span className="field__opt">(optional)</span>
            </label>
            <input {...text('superior')} placeholder="Printed under “Approved by”" />
          </div>
          <div className="field field--wide">
            <label className="field__label" htmlFor="p-reason">Reason/s</label>
            <p className="field__hint" id="p-reason-hint">
              Why the overtime was needed. Two lines fit on the form.
            </p>
            <textarea
              {...text('reason')}
              className="input textarea"
              rows={2}
              maxLength={160}
              aria-describedby="p-reason-hint"
              placeholder="e.g. Network maintenance and enrollment system support after office hours"
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="p-hrLead">
              HR campus lead <span className="field__opt">(optional)</span>
            </label>
            <input {...text('hrLead')} placeholder="Printed under “Received by”" />
          </div>
        </div>

        <div className="subsection">
          <h3 className="subsection__title">
            <Icon name="pencil" /> Signatures
          </h3>
          <p className="field__hint">
            Draw with the mouse, a finger or a stylus — or upload a photo of the signature on white paper; the paper is
            removed so only the ink lands on the form.
          </p>
        </div>
        <div className="fields fields--2">
          <SignatureField
            id="sig-mine"
            label="Your signature"
            hint="Over your name, above “Requestor”."
            value={signatures.mine}
            onChange={signatures.setMine}
            remember={{ checked: signatures.remember, onChange: signatures.setRemember }}
          />
          <SignatureField
            id="sig-supervisor"
            label="Supervisor’s signature (optional)"
            hint="Above “Immediate Superior”. Kept only until you close this tab."
            value={signatures.supervisor}
            onChange={signatures.setSupervisor}
          />
        </div>
      </div>
    </section>
  );
}
