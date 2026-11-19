// Internal reference page for designers and developers (English only, see ADR-0029).
import {
  AddOnStepper,
  Badge,
  Button,
  Checkbox,
  DenominationCounter,
  Dialog,
  EmptyState,
  Field,
  Input,
  Pagination,
  PinPad,
  RadioGroup,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  StatCard,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Textarea,
  toast,
  Tooltip,
  TR,
  VehicleClassTile,
  type DenominationCount,
} from '@stopwash/ui';
import { Bike, Car, CarFront, Search, Truck, WifiOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Logo } from '@/app/Logo';

const SEMANTIC = [
  'bg',
  'surface',
  'surface-2',
  'surface-inverse',
  'fg',
  'fg-muted',
  'fg-subtle',
  'border-strong',
  'primary',
  'accent',
  'link',
  'success',
  'warning',
  'danger',
  'info',
  'success-subtle',
  'warning-subtle',
  'danger-subtle',
  'info-subtle',
];
const BRAND = ['lime', 'navy', 'ink', 'paper', 'steel', 'leaf'];
const DENOMS = [500000, 200000, 100000, 50000, 10000, 5000, 2000];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-14 rounded-lg border border-border"
        style={{ background: `var(${varName})` }}
      />
      <code className="text-xs text-fg-muted">{name}</code>
    </div>
  );
}

export function DesignSystemPage() {
  const [method, setMethod] = useState('CASH');
  const [vehicle, setVehicle] = useState('SMALL');
  const [wax, setWax] = useState(0);
  const [freshener, setFreshener] = useState(2);
  const [pin, setPin] = useState('');
  const [page, setPage] = useState(3);
  const [count, setCount] = useState<DenominationCount>({
    notes: { '100000': 4 },
    coinsCents: 5000,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-20">
      <header>
        <p className="text-sm font-semibold tracking-widest text-link uppercase">STOPWASH OS</p>
        <h1 className="font-display text-4xl font-bold">Design system</h1>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Tokens and components from <code>packages/ui</code>. Switch theme in the top bar to check
          both modes.
        </p>
      </header>

      <Section title="Colour · brand">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {BRAND.map((c) => (
            <Swatch key={c} name={c} varName={`--color-${c}`} />
          ))}
        </div>
      </Section>
      <Section title="Colour · semantic">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7">
          {SEMANTIC.map((c) => (
            <Swatch key={c} name={c} varName={`--sw-${c}`} />
          ))}
        </div>
      </Section>

      <Section title="Type">
        <Logo className="h-16 text-ink dark:text-lime" />
        <p className="font-display text-display font-bold">Display · Space Grotesk</p>
        <p className="font-display text-4xl font-bold">Heading 1 · Space Grotesk</p>
        <p className="font-display text-2xl font-bold">Heading 2</p>
        <p className="font-display text-xl font-semibold">Heading 3</p>
        <p className="text-base">Body · Inter. සිංහල අකුරු · தமிழ் எழுத்துக்கள்</p>
        <p className="text-sm text-fg-muted">Small muted text</p>
        <p className="tabular font-mono text-lg">LKR 12,345.00 · KTB-261115-007</p>
      </Section>

      <Section title="Radius & elevation">
        <div className="flex flex-wrap gap-4">
          {['sm', 'md', 'lg', 'xl', '2xl'].map((r) => (
            <div
              key={r}
              className="grid size-20 place-items-center bg-surface-2 text-xs"
              style={{ borderRadius: `var(--radius-${r})` }}
            >
              {r}
            </div>
          ))}
          {['xs', 'sm', 'md', 'lg'].map((s) => (
            <div
              key={s}
              className="grid size-20 place-items-center rounded-lg bg-surface text-xs"
              style={{ boxShadow: `var(--shadow-${s})` }}
            >
              shadow-{s}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons & badges">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button loading>Saving</Button>
          <Button size="xl">Take payment</Button>
          <Tooltip content="Tooltip text">
            <Button variant="outline" size="icon" aria-label="Search">
              <Search />
            </Button>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['neutral', 'brand', 'accent', 'success', 'warning', 'danger', 'info'] as const).map(
            (t) => (
              <Badge key={t} tone={t}>
                {t}
              </Badge>
            ),
          )}
          <Badge tone="success" dot>
            Live
          </Badge>
        </div>
      </Section>

      <Section title="Forms">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle plate" required hint="Letters and numbers">
            {(p) => <Input {...p} inputSize="lg" placeholder="WP CAB-1234" />}
          </Field>
          <Field label="Phone" error="Enter a valid number">
            {(p) => <Input {...p} defaultValue="07712" />}
          </Field>
          <Field label="Category">
            {(p) => (
              <Select
                {...p}
                placeholder="Choose…"
                options={[
                  { value: 'E001', label: 'E001 · Cleaning supplies' },
                  { value: 'E002', label: 'E002 · Equipment repairs' },
                ]}
              />
            )}
          </Field>
          <Field label="Notes">{(p) => <Textarea {...p} />}</Field>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-2">
            <Checkbox id="ds-cb" defaultChecked />
            <label htmlFor="ds-cb">Checkbox</label>
          </span>
          <span className="flex items-center gap-2">
            <Switch id="ds-sw" defaultChecked />
            <label htmlFor="ds-sw">Switch</label>
          </span>
          <RadioGroup
            defaultValue="EXPENSE"
            aria-label="Type"
            options={[
              { value: 'EXPENSE', label: 'Expense' },
              { value: 'DEPOSIT', label: 'Deposit' },
            ]}
          />
        </div>
        <SegmentedControl
          aria-label="Payment method"
          value={method}
          onValueChange={setMethod}
          size="lg"
          options={[
            { value: 'CASH', label: 'Cash' },
            { value: 'CARD', label: 'Card' },
            { value: 'SPLIT', label: 'Split' },
          ]}
          className="max-w-md"
        />
      </Section>

      <Section title="Overlays & feedback">
        <div className="flex flex-wrap gap-3">
          <Dialog
            title="Cancel order"
            description="A reason is required."
            trigger={<Button variant="outline">Open dialog</Button>}
            footer={<Button variant="danger">Cancel order</Button>}
          >
            <Field label="Reason">{(p) => <Textarea {...p} />}</Field>
          </Dialog>
          <Sheet
            title="Checkout"
            trigger={<Button variant="outline">Open sheet</Button>}
            footer={
              <Button block size="lg">
                Pay LKR 1,250
              </Button>
            }
          >
            Order lines…
          </Sheet>
          <Button variant="outline" onClick={() => toast.success('Payment recorded')}>
            Success toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.warning('Variance LKR 750 needs an explanation')}
          >
            Warning toast
          </Button>
        </div>
      </Section>

      <Section title="Data display">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Revenue today"
            value="LKR 48,250"
            deltaPct={12.4}
            deltaLabel="vs last Sat"
          />
          <StatCard label="Vehicles" value="9 / 15" progress={60} />
          <StatCard label="Variance" value="-LKR 120" deltaPct={-3} loading />
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Plate</TH>
              <TH>Service</TH>
              <TH className="text-right">Amount</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD className="font-semibold">WP CAB-1234</TD>
              <TD>Medium (SUV) + Wax</TD>
              <TD className="tabular text-right">LKR 1,250.00</TD>
              <TD>
                <Badge tone="warning">Queued</Badge>
              </TD>
            </TR>
            <TR>
              <TD className="font-semibold">WP KX-4521</TD>
              <TD>Bike</TD>
              <TD className="tabular text-right">LKR 500.00</TD>
              <TD>
                <Badge tone="success">Paid</Badge>
              </TD>
            </TR>
          </TBody>
        </Table>
        <Pagination
          page={page}
          pageCount={9}
          onPageChange={setPage}
          summary={`Showing ${page * 10 - 9} to ${page * 10} of 86`}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <EmptyState title="No orders yet" description="New orders appear here." />
          <EmptyState
            tone="warning"
            icon={<WifiOff />}
            title="You're offline"
            description="Changes will sync when the connection is back."
          />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </Section>

      <Section title="POS parts">
        <div
          role="radiogroup"
          aria-label="Vehicle class"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            ['BIKE', 'Bike', 50000, <Bike key="b" />],
            ['SMALL', 'Small car', 75000, <Car key="s" />],
            ['MEDIUM', 'Medium (SUV)', 100000, <CarFront key="m" />],
            ['LARGE', 'Large (Van)', 125000, <Truck key="l" />],
          ].map(([code, name, price, icon], i) => (
            <VehicleClassTile
              key={code as string}
              name={name as string}
              priceCents={price as number}
              icon={icon as ReactNode}
              selected={vehicle === code}
              onSelect={() => setVehicle(code as string)}
              shortcut={String(i + 1)}
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <AddOnStepper name="Wax" unitPriceCents={25000} qty={wax} max={1} onChange={setWax} />
          <AddOnStepper
            name="Air freshener"
            unitPriceCents={50000}
            qty={freshener}
            onChange={setFreshener}
          />
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <DenominationCounter denominations={DENOMS} value={count} onChange={setCount} />
          <div className="flex justify-center">
            <PinPad value={pin} onChange={setPin} onComplete={() => setPin('')} />
          </div>
        </div>
      </Section>
    </div>
  );
}
