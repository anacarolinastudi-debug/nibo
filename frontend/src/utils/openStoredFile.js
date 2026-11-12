import api from '../api/client';

// Os arquivos não ficam mais públicos: baixamos com o token de login
// e abrimos uma cópia temporária no navegador.
export async function fetchStoredFileUrl(path) {
  const { data } = await api.get(path, { responseType: 'blob' });
  return URL.createObjectURL(data);
}

export async function openStoredFile(path) {
  const popup = window.open('', '_blank');
  try {
    const url = await fetchStoredFileUrl(path);
    if (popup) popup.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    if (popup) popup.close();
    let message = 'Não foi possível abrir o arquivo.';
    try {
      const text = await error.response?.data?.text?.();
      message = JSON.parse(text).error || message;
    } catch {
      // mantém a mensagem padrão
    }
    window.alert(message);
  }
}
