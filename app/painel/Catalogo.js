export default function Catalogo({ data, busy, act, copy }) {
  return <>
    <form onSubmit={event => act(event, 'piece')}>
        <h2>Adicionar peça</h2>
        <label>Nome da peça ou cor<input name="name" maxLength={120} required /></label>
        <label>Foto da peça<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
        <label>Link de compra (opcional)<input name="product" type="url" placeholder="https://…" /></label>
        <button disabled={busy}>Salvar peça</button>
      </form>
      <section>
        <h2>Peças cadastradas</h2>
        {!data.pieces.length && <p>Cadastre a primeira peça para gerar o link.</p>}
        {data.pieces.map(piece => {
          const path = '/testar?peca=' + piece.id
          return <article className="piece-row" key={piece.id}>
            <div><strong>{piece.name}</strong><small>{piece.enabled ? 'Ativa' : 'Pausada'}</small></div>
            {piece.enabled && <><a href={path}>Abrir provador</a><button type="button" className="secondary" onClick={() => copy(path)}>Copiar link</button></>}
            <form className="inline" onSubmit={event => act(event, 'toggle')}>
              <input type="hidden" name="piece" value={piece.id} /><input type="hidden" name="enabled" value={String(!piece.enabled)} />
              <button disabled={busy}>{piece.enabled ? 'Pausar' : 'Ativar'}</button>
            </form>
            <form className="variant-form" onSubmit={event => act(event, 'variant')}>
              <input type="hidden" name="piece" value={piece.id} />
              <label>ID da variante na vitrine
                <input name="variant" key={data.variants?.[piece.id] || 'empty'} defaultValue={data.variants?.[piece.id] || ''} maxLength={80} />
              </label>
              <button className="secondary" disabled={busy}>Salvar vínculo</button>
            </form>
          </article>
        })}
      </section>
  </>
}
