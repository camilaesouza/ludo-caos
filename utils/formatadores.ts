export function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function nomeCurto(email: string) {
  return email.split('@')[0]
}
