import Image from "next/image";

export function PackageContents() {
  return (
    <div className="guide-package-layout">
      <header className="guide-package-header">
        <h2 id="package-heading" className="mp-heading">Your Neffi has everything<br />you need to get started.</h2>
        <p>Everything you need to activate and start sharing.</p>
      </header>
      <figure className="guide-package-art">
        <Image src="/neffi-card-front-preview.svg" alt="Neffi card front" width={324} height={205} />
      </figure>
      <dl className="guide-contents">
        <div>
          <dt><span className="guide-content-number" aria-hidden="true">01</span><span>Neffi card</span></dt>
          <dd>Tap the card with NFC to open your digital profile.</dd>
        </div>
        <div>
          <dt><span className="guide-content-number" aria-hidden="true">02</span><span>Activation QR</span></dt>
          <dd>Scan the package QR to open Neffi activation.</dd>
        </div>
        <div>
          <dt><span className="guide-content-number" aria-hidden="true">03</span><span>Private activation code</span></dt>
          <dd>Enter the private code to connect your Neffi to your account.</dd>
        </div>
        <div>
          <dt><span className="guide-content-number" aria-hidden="true">04</span><span>Sharing QR</span></dt>
          <dd>Scan the QR on the back of your card to open your profile.</dd>
        </div>
      </dl>
    </div>
  );
}
