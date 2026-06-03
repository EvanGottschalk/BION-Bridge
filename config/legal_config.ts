// Centralised copy for the Terms and Privacy pages.
// See CLAUDE.md Non-Negotiable Rule #1.

export const LEGAL_ENTITY = 'Aphid';
export const LEGAL_CONTACT_EMAIL = 'support@aphid.com';
export const LEGAL_JURISDICTION = 'the State of California, United States';
export const LEGAL_LAST_UPDATED = 'June 3, 2026';

export const TERMS_ROUTE = '/terms';
export const PRIVACY_ROUTE = '/privacy';

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalPageContent = {
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export const TERMS_PAGE: LegalPageContent = {
  title: 'Terms of Use',
  intro:
    `These Terms of Use ("Terms") govern your access to and use of the ${LEGAL_ENTITY} bridge interface (the "Interface"), a non-custodial frontend that routes cross-chain token swaps through the Relay protocol. By connecting a wallet or otherwise using the Interface, you agree to these Terms. If you do not agree, do not use the Interface.`,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      heading: '1. Non-Custodial Service',
      paragraphs: [
        `The Interface is a purely non-custodial application. ${LEGAL_ENTITY} does not take custody of, hold, control, or have access to any of your funds, private keys, seed phrases, or digital assets at any point. All transactions are initiated and signed by you from your own self-custodial wallet and executed by independent third-party smart contracts and solvers operated by the Relay protocol.`,
        `${LEGAL_ENTITY} is not a broker, dealer, exchange, money transmitter, custodian, or financial institution. We do not offer investment, financial, legal, or tax advice.`,
      ],
    },
    {
      heading: '2. Eligibility',
      paragraphs: [
        `You represent that you are of legal age in your jurisdiction, that you have the legal capacity to enter into these Terms, and that you are not located in, ordinarily resident in, or a citizen of any jurisdiction subject to comprehensive sanctions or where use of the Interface would be unlawful. You are solely responsible for compliance with all laws applicable to you, including tax, securities, and AML/CFT laws.`,
      ],
    },
    {
      heading: '3. Assumption of Risk',
      paragraphs: [
        `Cross-chain bridging and token swapping involve substantial risk, including but not limited to: smart-contract bugs and exploits, oracle or relayer failure, network congestion, frontrunning and MEV, slippage, sudden price movement, loss of liquidity, irreversibility of on-chain transactions, and the total loss of the assets you transact with.`,
        `By using the Interface you accept these risks in full. You alone are responsible for verifying every transaction before signing it, including the destination address, the chain, the token, and the amount. Transactions on public blockchains are generally final and cannot be reversed by ${LEGAL_ENTITY}.`,
      ],
    },
    {
      heading: '4. Third-Party Protocols',
      paragraphs: [
        `The Interface relies on third-party infrastructure, including the Relay protocol, RPC providers, wallet providers, and underlying blockchain networks. ${LEGAL_ENTITY} does not operate, control, or audit these systems and is not responsible for their performance, security, availability, fees, or for any losses arising from their use.`,
      ],
    },
    {
      heading: '5. No Warranty',
      paragraphs: [
        `THE INTERFACE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, OR UNINTERRUPTED OR ERROR-FREE OPERATION.`,
        `${LEGAL_ENTITY} makes no warranty that the Interface will meet your requirements, that quoted rates will be achievable, that transactions will succeed, or that data displayed will be accurate or current.`,
      ],
    },
    {
      heading: '6. Limitation of Liability',
      paragraphs: [
        `TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${LEGAL_ENTITY.toUpperCase()}, ITS AFFILIATES, AND ITS CONTRIBUTORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR DIGITAL ASSETS, ARISING OUT OF OR RELATED TO YOUR USE OF (OR INABILITY TO USE) THE INTERFACE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.`,
      ],
    },
    {
      heading: '7. Prohibited Use',
      paragraphs: [
        `You agree not to use the Interface to violate any law; to launder proceeds of crime; to evade sanctions; to interfere with the Interface's operation; to reverse engineer, scrape, or overload our infrastructure; or to engage in any activity that is fraudulent, manipulative, or harmful to other users.`,
      ],
    },
    {
      heading: '8. Changes to the Interface and Terms',
      paragraphs: [
        `${LEGAL_ENTITY} may modify, suspend, or discontinue all or part of the Interface at any time without notice. We may also update these Terms; continued use of the Interface after an update constitutes acceptance of the revised Terms. The "Last updated" date at the top of this page reflects the most recent revision.`,
      ],
    },
    {
      heading: '9. Governing Law',
      paragraphs: [
        `These Terms are governed by the laws of ${LEGAL_JURISDICTION}, without regard to its conflict-of-laws principles. Any dispute arising out of or relating to these Terms or the Interface will be brought exclusively in the state or federal courts located in California, and you consent to personal jurisdiction there.`,
      ],
    },
    {
      heading: '10. Contact',
      paragraphs: [
        `Questions about these Terms may be sent to ${LEGAL_CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const PRIVACY_PAGE: LegalPageContent = {
  title: 'Privacy Policy',
  intro:
    `This Privacy Policy describes how ${LEGAL_ENTITY} handles information in connection with your use of the ${LEGAL_ENTITY} bridge interface (the "Interface"). The Interface is a non-custodial frontend; we collect as little information as practical to operate it.`,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      heading: '1. Information We Do Not Collect',
      paragraphs: [
        `We do not collect names, email addresses, government identifiers, passwords, or any other directly identifying account information through the Interface. We do not custody your funds, and we have no access to your private keys, seed phrases, or signed transactions beyond what you broadcast on-chain.`,
      ],
    },
    {
      heading: '2. Information Processed Automatically',
      paragraphs: [
        `When you visit the Interface, our hosting and analytics providers automatically receive standard request metadata, including IP address, user-agent, referrer, approximate region derived from IP, and pages or events viewed. We use this only to operate the site, prevent abuse, debug errors, and understand aggregate usage. We currently use Vercel Analytics, which is configured to be privacy-preserving and does not use third-party cookies for cross-site tracking.`,
        `Wallet addresses you connect, the chains you select, and the transactions you sign are public on the underlying blockchains. We may log these interactions transiently in order to fetch quotes, build calldata, surface status to you, and diagnose failures. We do not link wallet addresses to personally identifying information.`,
      ],
    },
    {
      heading: '3. Third-Party Services',
      paragraphs: [
        `To provide a functioning bridge, the Interface communicates with third-party services that operate under their own privacy policies, including the Relay protocol, RPC node providers, wallet providers (such as those exposed through RainbowKit and connected wallet SDKs), token-icon providers, and hosting and analytics providers. We do not control how these third parties process information; you should review their policies if you have questions about their practices.`,
      ],
    },
    {
      heading: '4. Cookies and Local Storage',
      paragraphs: [
        `The Interface and the wallet SDKs it integrates may store small amounts of data in your browser's local storage (for example, your preferred wallet connector, recent chain selection, or theme). This data stays on your device and is used to make the Interface work; it is not sent to us for tracking.`,
      ],
    },
    {
      heading: '5. On-Chain Data',
      paragraphs: [
        `Transactions you sign and broadcast are recorded on public blockchains and are outside our control. Once a transaction is on-chain, it is publicly visible and cannot be deleted by ${LEGAL_ENTITY}.`,
      ],
    },
    {
      heading: '6. Children',
      paragraphs: [
        `The Interface is not directed to children under 13 (or the equivalent minimum age in your jurisdiction), and we do not knowingly collect information from them.`,
      ],
    },
    {
      heading: '7. Your Rights',
      paragraphs: [
        `Depending on your jurisdiction, you may have rights regarding the limited information we process, such as the right to access, correct, or delete certain data, or to object to processing. To exercise any such rights, contact ${LEGAL_CONTACT_EMAIL}. Because we do not maintain user accounts, we may need additional information from you in order to act on a request.`,
      ],
    },
    {
      heading: '8. Changes to This Policy',
      paragraphs: [
        `We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last updated" date above. Your continued use of the Interface after an update constitutes acceptance of the revised Policy.`,
      ],
    },
    {
      heading: '9. Contact',
      paragraphs: [
        `Questions about this Privacy Policy may be sent to ${LEGAL_CONTACT_EMAIL}.`,
      ],
    },
  ],
};
