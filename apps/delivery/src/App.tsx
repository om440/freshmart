function App() {
  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="/">Good Basket <span>Delivery</span></a>
        <span className="role-label">Delivery workspace</span>
      </header>
      <section className="welcome">
        <p className="eyebrow">DELIVERY WORKSPACE</p>
        <h1>Your next delivery starts here.</h1>
        <p>Assigned orders, destination details, and delivery status updates will live here.</p>
        <div className="next-card">
          <strong>Next up</strong>
          <p>Connect this workspace to the API and add a delivery queue scoped to the signed-in delivery person.</p>
        </div>
      </section>
    </main>
  );
}

export default App;
