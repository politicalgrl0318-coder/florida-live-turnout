import styles from './general.module.css';

const comparisons = [
  {district: 'FL-27', candidate: 'Eliott Rodriguez', returned: 'D+8.80', mail: 'D+20.45', lead: '13,975', gap: '11.65'},
  {district: 'FL-28', candidate: 'Phil Ehr', returned: 'D+0.31', mail: 'D+12.33', lead: '6,708', gap: '12.03'},
];

export default function ElectionAnalysis() {
  return (
    <section className={styles.tableCard} aria-labelledby="election-analysis-heading">
      <div className={styles.tableHead}>
        <div>
          <h2 id="election-analysis-heading">South Florida election analysis</h2>
          <p>In FL-28, Phil Ehr won the two-party mail vote by 6,708 votes after Democratic and Republican mail returns were nearly even in the November 2 snapshot.</p>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th scope="col">District</th><th scope="col">Democrat</th><th scope="col">Mail return margin by registration</th><th scope="col">Two-party House mail margin</th><th scope="col">House mail vote lead</th><th scope="col">Gap toward D (points)</th></tr></thead>
          <tbody>
            {comparisons.map(row => <tr key={row.district}><th scope="row">{row.district}</th><td>{row.candidate}</td><td>{row.returned}</td><td>{row.mail}</td><td>{row.lead}</td><td>{row.gap}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className={styles.tableHead}>
        <div>
          <p>The gap compares the November 2 registration mix among Democratic and Republican mail returners with the later unofficial county candidate counts. It is calculated before rounding. The two snapshots have different cutoffs, and the gap does not measure individual crossover.</p>
          <p>Across all voting methods, David Jolly ran 0.55 points ahead of Angie Nixon on two-party share in the matched FL-27 precincts. Nixon ran 0.19 points ahead of Jolly in the matched FL-28 precincts.</p>
          <p><a href="/general/districts">District turnout</a> · <a href="https://enr.electionsfl.org/DAD/4087/Reports/">Miami-Dade results</a> · <a href="https://enr.electionsfl.org/MON/4109/Summary/">Monroe results</a></p>
        </div>
      </div>
    </section>
  );
}
