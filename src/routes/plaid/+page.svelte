<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { onMount, setContext } from 'svelte';
  import type { Transaction } from 'plaid';
  import DataTable from './data-table.svelte';

  let Plaid: any;
  let plaid_login: any;
  let transactions: Transaction[] = [];
  export let data;

  onMount(async () => {
    Plaid = window.Plaid;
    plaid_login = await createLogin();
    console.log("Plaid login object:", plaid_login)
  });

  const getTransactions = async () => {
    console.log('getTransactions');
    const res = await fetch('/api/plaid/transactions');
    const data = await res.json();
    console.log("Transaction data:", data)
    transactions = data.transactions;
  };

  const getLinkToken = async () => {
    const response = await fetch('/api/plaid/link-token');
    const data = await response.json();
    return data.link_token;
  };

  const exchangePublicToken = async (public_token: string, metadata: any) => {
    console.log("Trying to fetch access-token for plaid")
    console.log("public token:", public_token)
    console.log("metadata:", metadata)
    await fetch('/api/plaid/access-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ public_token: public_token, metadata: metadata })
    });
  };

  const createLogin = async () => {
    const token = await getLinkToken();
    const config = { token: token, onSuccess: exchangePublicToken };
    const plaidClient = Plaid.create(config);
    console.log("plaid client:", plaidClient)
    return plaidClient;
  };

  const openPlaidLogin = () => {
    if (plaid_login) {
      plaid_login.open();
    }
  };
</script>

<svelte:head>
  <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
</svelte:head>

<Button on:click={openPlaidLogin}>Link Plaid Account</Button>
<Button on:click={getTransactions}>Get Transactions</Button>
<div class="container mx-auto py-10">
  <DataTable {transactions} supabase={data.supabase} />
</div>
