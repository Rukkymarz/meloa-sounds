export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <div className="empty" style={{ marginTop: 24 }}>
      <h3>You&apos;re offline</h3>
      <p>Meloa needs a connection to play music. Check your Wi-Fi or mobile data, then try again.</p>
      <a href="/" className="btn btn-plum">Try again</a>
    </div>
  );
}
