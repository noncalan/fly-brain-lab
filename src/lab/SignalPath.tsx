import behaviorsConfig from '../../config/behaviors.json';
import stimuliConfig from '../../config/stimuli.json';
import { categoryOf } from '../content/regions';
import { useI18n, type StringKey } from '../i18n';
import type { BehaviorState } from '../sim';

const NEURON_LABEL: Record<string, string> = { mn9: 'MN9', giant_fiber: 'Giant Fiber (DNp01)', adn1: 'aDN1' };

interface Props {
  stimulusId: string | null;
  setRatesHz: Record<string, number>;
  topRegions: string[];
  behaviors: BehaviorState[];
}

/** receptor -> processing -> motor/descending neuron -> action, each lit by the live rate of that stage */
export function SignalPath({ stimulusId, setRatesHz, topRegions, behaviors }: Props) {
  const { t, n, lang } = useI18n();
  const stimulus = stimuliConfig.stimuli.find((s) => s.id === stimulusId);
  if (!stimulus) return <p className="text-sm text-muted">{t('path.idle')}</p>;

  const expected = behaviorsConfig.behaviors.find((b) => stimulus.expects.includes(b.id));
  const behaviorState = expected && behaviors.find((b) => b.id === expected.id);
  const receptorHz = setRatesHz[stimulus.set] ?? 0;
  const motorHz = expected ? setRatesHz[expected.readout] ?? 0 : 0;
  const regionText = topRegions
    .slice(0, 2)
    .map((r) => `${r}${categoryOf(r) ? ` · ${categoryOf(r)!.name[lang]}` : ''}`)
    .join(', ');

  const stages = [
    { label: t('path.receptor'), value: t(`stim.${stimulus.id}` as StringKey), level: Math.min(1, receptorHz / 100), detail: `${n(receptorHz)} Hz` },
    { label: t('path.processing'), value: regionText || '—', level: topRegions.length ? 1 : 0, detail: '' },
    {
      label: t('path.motor'),
      value: expected ? NEURON_LABEL[expected.readout] ?? expected.readout : '—',
      level: expected ? Math.min(1, motorHz / (expected.thresholdHz * 3)) : 0,
      detail: expected ? `${n(motorHz, 1)} Hz` : '',
    },
    {
      label: t('path.action'),
      value: behaviorState?.active ? t(`beh.${expected!.id}` as StringKey) : t('path.noAction'),
      level: behaviorState?.active ? 1 : 0,
      detail: '',
    },
  ];

  return (
    <ol className="grid gap-2 sm:grid-cols-4" aria-live="polite">
      {stages.map((s, i) => (
        <li key={s.label} className="relative">
          <div
            className="rounded-lg border p-2 text-xs transition-colors"
            style={{
              borderColor: `rgb(var(--accent) / ${0.25 + 0.75 * s.level})`,
              background: `rgb(var(--accent) / ${0.04 + 0.16 * s.level})`,
            }}
          >
            <p className="text-muted">{s.label}</p>
            <p className="mt-0.5 font-medium">{s.value}</p>
            {s.detail && <p className="font-mono text-muted">{s.detail}</p>}
          </div>
          {i < stages.length - 1 && (
            <span aria-hidden="true" className="absolute -right-2 top-1/2 hidden h-px w-2 overflow-visible sm:block">
              <span
                className="signal-dot absolute -top-[3px] left-0 h-1.5 w-1.5 rounded-full bg-accent"
                style={{ opacity: stages[i + 1].level > 0 ? 1 : 0.15 }}
              />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
