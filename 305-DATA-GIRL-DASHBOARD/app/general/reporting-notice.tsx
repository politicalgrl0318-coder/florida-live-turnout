import styles from "./general.module.css";

type CountyReport = {
  name: string;
  provided: { compiled?: string };
  voted: { compiled?: string };
};

const officialStats = "https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats";
const postalNotice = "https://about.usps.com/newsroom/national-releases/2026/1005-usps-will-be-closed-in-observance-of-columbus-day-october-12.htm";

export default function ReportingNotice({ compiled, counties, reportingNote }: {
  compiled: string;
  counties: CountyReport[];
  reportingNote?: string;
}) {
  const reportDate = compiled.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
  const older = counties.filter((county) => {
    const countyDate = (county.voted.compiled || county.provided.compiled || "").match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    return countyDate && reportDate && countyDate !== reportDate;
  });
  return <aside className={styles.reportingNotice} aria-label="Reporting dates and postal holiday notice">
    {reportDate === "10/12/2026" && <p><strong>Columbus Day mail delay · October 12</strong><br />USPS paused regular mail delivery for the holiday; delivery resumes Tuesday, October 13. Ballots mailed over the weekend may still be in transit and enter these totals after counties receive and report them. <a href={postalNotice} target="_blank" rel="noreferrer">USPS notice ↗</a></p>}
    <p><strong>Reporting dates:</strong> Florida published this compilation on {compiled} ET. Figures are cumulative through the prior day, using each county’s latest submission. {older.length > 0 && <>Earlier county reports remain included: {older.map((county) => `${county.name} (${county.voted.compiled || county.provided.compiled} ET)`).join("; ")}. </>}<a href={officialStats} target="_blank" rel="noreferrer">Official state report ↗</a></p>
    {reportingNote && <p role="status"><strong>Source status:</strong> {reportingNote}</p>}
  </aside>;
}
