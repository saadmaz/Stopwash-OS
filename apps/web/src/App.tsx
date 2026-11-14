import { formatLKR } from '@stopwash/shared';

export function App() {
  return (
    <main>
      <h1>STOPWASH POS</h1>
      <p>Foundation ready. {formatLKR(0)}</p>
    </main>
  );
}
