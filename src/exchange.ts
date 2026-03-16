const API_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';

export async function getUsdToBrl(): Promise<number> {
  const response = await fetch(API_URL);
  const data = await response.json();
  return parseFloat(data.USDBRL.bid);
}
