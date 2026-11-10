export type Status = 'available' | 'building' | 'soon';

export type Feature = {
  id: string;
  group: string;
  name: string;
  status: Status;
  /** Shown in place of the generic status when a feature is limited to testnet. */
  statusText?: string;
  priority?: boolean;
  summary: string;
  href?: string;
};

export const groups = [
  'Wallet & Onboarding',
  'Staking & DeFi',
  'Trading & Payments',
  'Ecosystem Discovery',
  'Automation & Security',
] as const;

export const features: Feature[] = [
  { id: 'assistant', group: 'Wallet & Onboarding', name: 'Wallet Assistant', status: 'building', priority: true, href: '/assistant', summary: 'A live model answers when an API key is set. A testnet stake or Tidepool quote can be approved here. The wallet still signs. Mainnet stays off.' },
  { id: 'connect', group: 'Wallet & Onboarding', name: 'Wallet connection', status: 'available', href: '/wallet', summary: 'Connect a NEAR wallet. Approval stays in that wallet.' },
  { id: 'first-visit', group: 'Wallet & Onboarding', name: 'First-visit guide', status: 'available', href: '/', summary: 'The homepage and suggested requests are ready.' },
  { id: 'glossary', group: 'Wallet & Onboarding', name: 'Glossary', status: 'available', href: '/settings#help', summary: 'Short definitions for accounts, gas, and staking.' },
  { id: 'receive', group: 'Wallet & Onboarding', name: 'Receive address', status: 'available', href: '/wallet', summary: 'Copy the signed-in account. Samples stay labelled.' },
  { id: 'multi-wallet', group: 'Wallet & Onboarding', name: 'Multiple wallets', status: 'soon', summary: 'A saved list of several wallets is not built.' },
  { id: 'easy-staking', group: 'Staking & DeFi', name: 'Easy Staking', status: 'available', statusText: 'Available (Testnet)', priority: true, href: '/staking', summary: 'Testnet staking is available. Your wallet approves each stake. Mainnet staking is off.' },
  { id: 'unstake', group: 'Staking & DeFi', name: 'Unstake and withdraw', status: 'building', href: '/staking#unstake', summary: 'The wait is explained. Unstake is not built.' },
  { id: 'validators', group: 'Staking & DeFi', name: 'Validator references', status: 'available', href: '/staking', summary: 'Pools list the commission read from each contract.' },
  { id: 'positions', group: 'Staking & DeFi', name: 'Staking positions', status: 'available', href: '/wallet', summary: 'Staked and pending amounts are read after you connect.' },
  { id: 'liquid', group: 'Staking & DeFi', name: 'Liquid staking comparison', status: 'soon', summary: 'Comparing stNEAR and liNEAR is not built.' },
  { id: 'defi-deposit', group: 'Staking & DeFi', name: 'DeFi walkthroughs', status: 'soon', summary: 'Directory links only. This app does not deposit for you.' },
  { id: 'funding', group: 'Trading & Payments', name: 'Cross-chain funding', status: 'available', statusText: 'Available (Testnet)', priority: true, href: '/funding', summary: 'Testnet funding is available. Your wallet approves each transfer. Success is Tidepool SUCCESS. Mainnet stays off.' },
  { id: 'send', group: 'Trading & Payments', name: 'Send NEAR', status: 'building', href: '/wallet', summary: 'The form checks the amount. It does not broadcast.' },
  { id: 'swap', group: 'Trading & Payments', name: 'Token swap', status: 'soon', summary: 'Swapping tokens here is not built.' },
  { id: 'pay-request', group: 'Trading & Payments', name: 'Payment requests', status: 'soon', summary: 'Payment requests are not built.' },
  { id: 'recurring', group: 'Trading & Payments', name: 'Recurring transfers', status: 'soon', summary: 'Scheduled transfers are not built.' },
  { id: 'fiat', group: 'Trading & Payments', name: 'Fiat purchase', status: 'soon', summary: 'Buying NEAR with a card is not built.' },
  { id: 'directory', group: 'Ecosystem Discovery', name: 'App directory', status: 'available', href: '/explore', summary: 'Public project sites. They are not integrations.' },
  { id: 'filters', group: 'Ecosystem Discovery', name: 'Search and filters', status: 'available', href: '/explore', summary: 'Search and category filters work on this list.' },
  { id: 'what-now', group: 'Ecosystem Discovery', name: 'What you can do', status: 'available', href: '/assistant', summary: 'Ask what you can do on NEAR for a plain map.' },
  { id: 'docs', group: 'Ecosystem Discovery', name: 'Documentation links', status: 'available', href: 'https://docs.near.org/', summary: 'Official NEAR docs open in a new tab.' },
  { id: 'safety', group: 'Ecosystem Discovery', name: 'Safety notes', status: 'available', href: '/settings#security', summary: 'Seed phrases stay in your wallet. Mainnet funds stay off.' },
  { id: 'picks', group: 'Ecosystem Discovery', name: 'Personal recommendations', status: 'soon', summary: 'Recommendations from your holdings are not built.' },
  { id: 'mode', group: 'Automation & Security', name: 'Simple and Advanced mode', status: 'available', href: '/settings', summary: 'Short or detailed explanations. Both stay on this device.' },
  { id: 'preview', group: 'Automation & Security', name: 'Transaction previews', status: 'available', href: '/funding', summary: 'Quotes show Tidepool’s output. They are not receipts.' },
  { id: 'approval', group: 'Automation & Security', name: 'Approval step', status: 'available', href: '/funding', summary: 'You confirm before a deposit address is prepared.' },
  { id: 'activity', group: 'Automation & Security', name: 'Activity history', status: 'building', href: '/activity', summary: 'One confirmed testnet stake and one confirmed funding transfer are listed. Later rows are saved on this device.' },
  { id: 'limits', group: 'Automation & Security', name: 'Spending limits', status: 'soon', summary: 'Spending limits are not built.' },
  { id: 'notifications', group: 'Automation & Security', name: 'Notification preferences', status: 'available', href: '/settings#notifications', summary: 'On or off choices are saved here. No alert service.' },
];

export const statusLabel: Record<Status, string> = {
  available: 'Available',
  building: 'In Development',
  soon: 'Coming Soon',
};

export type AppCategory =
  | 'DeFi'
  | 'Wallets'
  | 'Staking'
  | 'AI'
  | 'Gaming'
  | 'NFTs'
  | 'Social'
  | 'Infrastructure';

export const categories: AppCategory[] = [
  'DeFi',
  'Wallets',
  'Staking',
  'AI',
  'Gaming',
  'NFTs',
  'Social',
  'Infrastructure',
];

export type DirectoryApp = {
  name: string;
  category: AppCategory;
  description: string;
  url: string;
};

export const apps: DirectoryApp[] = [
  { name: 'Rhea Finance', category: 'DeFi', description: 'DeFi on NEAR for swaps, lending, and liquidity.', url: 'https://app.rhea.finance/' },
  { name: 'Meteor Wallet', category: 'Wallets', description: 'Self-custody wallet for NEAR on the web, in a browser extension, and on mobile.', url: 'https://meteorwallet.app/' },
  { name: 'HOT Wallet', category: 'Wallets', description: 'Multichain wallet. The browser extension is published by HOT Labs.', url: 'https://hot-labs.org/wallet/' },
  { name: 'MyNearWallet', category: 'Wallets', description: 'Web wallet for creating a NEAR account and holding NEAR.', url: 'https://app.mynearwallet.com/' },
  { name: 'NEAR wallet directory', category: 'Wallets', description: 'Official NEAR page that lists ecosystem wallets.', url: 'https://wallet.near.org/' },
  { name: 'Meta Pool', category: 'Staking', description: 'Liquid staking for NEAR.', url: 'https://www.metapool.app/' },
  { name: 'LiNEAR Protocol', category: 'Staking', description: 'Liquid staking on NEAR. Staked NEAR is represented by liNEAR.', url: 'https://linearprotocol.org/' },
  { name: 'Figment', category: 'Staking', description: 'Staking provider. Confirm the current commission before you delegate.', url: 'https://www.figment.io/staking/protocols/near-protocol/' },
  { name: 'Everstake', category: 'Staking', description: 'Staking provider. Confirm the listed commission before you delegate.', url: 'https://docs.everstake.com/staking-docs/procotols/near-near' },
  { name: 'NEAR AI', category: 'AI', description: 'NEAR’s site for private AI inference and agent tools.', url: 'https://near.ai/' },
  { name: 'Learn NEAR Club', category: 'Social', description: 'Community program for learning NEAR through hands-on tasks.', url: 'https://learnnear.club/' },
  { name: 'NEAR Intents', category: 'Infrastructure', description: 'NEAR’s cross-chain layer. This app uses Tidepool testnet only.', url: 'https://near.org/intents' },
  { name: 'Aurora', category: 'Infrastructure', description: 'Ethereum-compatible environment in the NEAR ecosystem, from Aurora Labs.', url: 'https://aurora.dev/' },
  { name: 'FastNEAR', category: 'Infrastructure', description: 'Infrastructure for reading NEAR and building applications against it.', url: 'https://fastnear.com/' },
  { name: 'NEAR Blocks', category: 'Infrastructure', description: 'Public explorer for accounts, transactions, and validators.', url: 'https://nearblocks.io/' },
  { name: 'NEAR Docs', category: 'Infrastructure', description: 'Official documentation for accounts, staking, and building on NEAR.', url: 'https://docs.near.org/' },
  { name: 'NEAR Treasury', category: 'Infrastructure', description: 'Multi-signature treasury dashboard for groups on NEAR.', url: 'https://app.neartreasury.com/' },
];

export type ValidatorInfo = {
  id: string;
  name: string;
  fee: string;
  url: string;
  about: string;
};

export const validators: ValidatorInfo[] = [
  {
    id: 'figment.poolv1.near',
    name: 'Figment',
    fee: 'Confirm the current commission on Figment’s site or NEAR Blocks. This app does not read it live.',
    url: 'https://www.figment.io/staking/protocols/near-protocol/',
    about: 'Institutional staking provider with the public pool account figment.poolv1.near.',
  },
  {
    id: 'everstake.poolv1.near',
    name: 'Everstake',
    fee: 'Everstake’s own NEAR docs list a 6% commission. This app does not check that figure on chain.',
    url: 'https://docs.everstake.com/staking-docs/procotols/near-near',
    about: 'Staking provider with the public pool account everstake.poolv1.near.',
  },
];

export const suggestions = [
  'Use $100 from Solana to stake NEAR.',
  'Help me get started on NEAR.',
  'Check my NEAR wallet.',
  'Show me what I can do on NEAR.',
];

export const glossary = [
  { term: 'Account name', body: 'The address that holds your NEAR. A named account looks like name.near. An implicit account is 64 letters and numbers and has no dot.' },
  { term: 'Gas', body: 'A small fee paid in NEAR to submit a transaction. You need a little liquid NEAR to pay it. NEAR does not use a separate gas token.' },
  { term: 'Validator', body: 'An operator who runs NEAR servers. You can delegate stake to their pool. The staking page reads the commission from the pool contract. Rewards are not guaranteed.' },
  { term: 'Epoch', body: 'NEAR groups time into epochs. An epoch is about 12 hours, and the length can vary. Unstaking takes 4 epochs. That is often about 2 days, and it can take longer.' },
  { term: 'Staking', body: 'You delegate NEAR to a validator to help secure the network. You still own it. Rewards change with the network and are not guaranteed.' },
  { term: 'Unstaking', body: 'You ask for staked NEAR back. It stays locked for 4 epochs. Rewards stop on that amount. After the wait, you withdraw it to your available balance. This app cannot unstake for you.' },
  { term: 'Cross-chain transfer', body: 'Moving test tokens from a network such as Solana devnet or Base Sepolia onto NEAR testnet. Tidepool quotes the route. The transfer and a later stake are separate. Real-money networks are not available here.' },
  { term: 'Tidepool', body: 'A community-operated testnet for NEAR Intents quotes. It is not affiliated with NEAR. Tokens have no value. NEAR Easy uses it only for testnet funding and does not send mainnet assets.' },
  { term: 'Test wNEAR', body: 'Tidepool’s test token, wnear.tidepool-sandbox.testnet. It has no unwrap method and is not wrap.testnet. It cannot be turned into the native NEAR Easy Staking uses. This app does not convert it or stake it.' },
  { term: 'Transaction preview', body: 'A summary of a Tidepool testnet quote or a stake you have not approved yet. It is not a receipt. Success is shown only after NEAR or Tidepool confirms it.' },
];

export const sampleWallet = {
  account: 'example.near',
  total: '123.46',
  available: '71.46',
  staked: '40.00',
  pending: '12.00',
};

export const homeTiles: { name: string; status: Status; href: string; icon: string }[] = [
  { name: 'Swap Tokens', status: 'soon', href: '/roadmap?status=soon', icon: 'arrows' },
  { name: 'Unstake & Exit', status: 'building', href: '/staking#unstake', icon: 'send' },
  { name: 'Validator Switch', status: 'soon', href: '/roadmap?status=soon', icon: 'shield' },
  { name: 'Earn Yield', status: 'soon', href: '/roadmap?status=soon', icon: 'layers' },
  { name: 'Recurring Buys', status: 'soon', href: '/roadmap?status=soon', icon: 'clock' },
  { name: 'All Features', status: 'available', href: '/roadmap', icon: 'grid' },
];

export type ExampleRow = {
  id: string;
  title: string;
  detail: string;
  amount: string;
  network: string;
  status: string;
  when: string;
  note: string;
};

export const statusExamples: ExampleRow[] = [
  {
    id: 'verified-example',
    title: 'Stake preview',
    detail: 'Layout example',
    amount: '1.00 NEAR',
    network: 'NEAR',
    status: 'Verified example',
    when: 'Example date',
    note: 'A verified row would link to NEAR Blocks. This example has no transaction hash, so there is no explorer link.',
  },
  {
    id: 'failed-example',
    title: 'Transfer preview',
    detail: 'Layout example',
    amount: '1.00 NEAR',
    network: 'NEAR',
    status: 'Failed example',
    when: 'Example date',
    note: 'Example failure: the wallet was not asked to sign. No funds moved.',
  },
  {
    id: 'pending-example',
    title: 'Funding preview',
    detail: 'Layout example',
    amount: '100.00 USDC',
    network: 'Solana to NEAR',
    status: 'Pending example',
    when: 'Example date',
    note: 'Example pending state. Nothing is waiting on a network.',
  },
];
