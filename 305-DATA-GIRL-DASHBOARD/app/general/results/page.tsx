import type { Metadata } from 'next';
import styles from '../general.module.css';
import Results, { type Snapshot } from './results';

export const metadata: Metadata = { title: 'Election Results | 305 Data Girl' };

export default async function ResultsPage() {
  let snapshot: Snapshot | null = null;
  try {
    const response = await fetch('https://florida-2026-results-explorer.axialember1.chatgpt.site/results.json', {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json() as Snapshot;
      if (data.election === '2026-11-03' && Array.isArray(data.counties) && Array.isArray(data.rows)) snapshot = data;
    }
  } catch {
    // Keep the official results link accessible if the snapshot is temporarily unavailable.
  }
  return <main className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.brand}><img src="/vanessa-brito.jpg" alt="Dr. Vanessa Brito"/><div><strong><b>305</b> Data Girl</strong><span>Florida Politics with Receipts</span></div></div>
      <div className={styles.eyebrow}><i/> NOVEMBER 3, 2026 · FLORIDA GENERAL ELECTION</div>
      <h1>Election Results</h1>
      <p className={styles.dek}>Explore Florida’s federal, state and local races by county.</p>
    </header>
    <div className={styles.content}>
      {snapshot ? <Results snapshot={snapshot}/> : <p role="status">The county snapshot is unavailable. <a href="https://floridaelectionwatch.gov/">Open official Florida results</a>.</p>}
    </div>
  </main>;
}
