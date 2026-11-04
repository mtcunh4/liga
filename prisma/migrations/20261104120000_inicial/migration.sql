-- =====================================================================
-- LIGA · estrutura do banco (PostgreSQL / Neon)
-- Migrada do Supabase (projeto liga-lancamentos) em 04/11/2026.
-- As regras de acesso continuam no banco: cada função confere o perfil
-- com _exigir(...). O servidor (Next.js) informa quem está logado com
-- set_config('app.uid', ...) antes de chamar a função; auth.uid() lê esse valor.
-- =====================================================================

-- As funções vêm antes das tabelas; o corpo é conferido só ao executar
SET check_function_bodies = false;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

--
-- Name: privado; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA privado;

--
-- Name: _comissao_json(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._comissao_json(p_emp text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object('div', e.comissao_div, 'total', public._total_div(e.comissao_div),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'k', l.k, 'q', l.q, 'l', l.l, 'c', l.corretor_nome, 'd', l.d, 'mv', l.mv, 'vv', l.vv,
        'ct', l.ct, 'ep', l.ep, 'lib', l.ct and l.ep,
        'tot', round(l.vv * public._total_div(e.comissao_div), 2),
        'partes', (select coalesce(jsonb_object_agg(dv->>'f', round(l.vv * (dv->>'p')::numeric, 2)), '{}'::jsonb) from jsonb_array_elements(e.comissao_div) dv),
        'nf', l.nf, 'dnf', l.dnf, 'pago', l.pago, 'dp', l.dp) order by l.d nulls last, l.q, l.l)
      from public.lotes l where l.emp_id = e.id and l.s = 'vend' and l.vv is not null), '[]'::jsonb))
  from public.emps e where e.id = p_emp
$$;

--
-- Name: _evento(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._evento(p_emp text, p_k text, p_evento text, p_detalhe text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.lote_eventos(emp_id, k, user_id, email, evento, detalhe)
  select p_emp, p_k, auth.uid(), (select email from public.perfis where user_id = auth.uid()), p_evento, left(coalesce(p_detalhe,''), 300)
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: perfis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfis (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    nome text NOT NULL,
    role text NOT NULL,
    all_emps boolean DEFAULT true NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    must_change boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_acesso timestamp with time zone,
    senha_expira timestamp with time zone,
    CONSTRAINT perfis_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'gestor'::text, 'empreendedor'::text, 'corretor'::text])))
);

--
-- Name: _exigir(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._exigir(p_roles text[]) RETURNS public.perfis
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v public.perfis;
begin
  select * into v from public.perfis where user_id = auth.uid() and ativo;
  if v.user_id is null then raise exception 'Sua sessão terminou ou seu acesso foi desativado.' using errcode = '42501'; end if;
  if v.must_change then raise exception 'Defina sua senha antes de continuar.' using errcode = '42501'; end if;
  if not (v.role = any(p_roles)) then raise exception 'Você não tem permissão para isso.' using errcode = '42501'; end if;
  return v;
end $$;

--
-- Name: _log(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._log(p_evento text, p_detalhe text DEFAULT ''::text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.acessos(user_id, email, evento, detalhe)
  select auth.uid(), (select email from public.perfis where user_id = auth.uid()), p_evento, left(coalesce(p_detalhe,''), 500)
$$;

--
-- Name: _lotes_json(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._lotes_json(p_emp text, p_role text, p_uid uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(
    case when p_role = 'corretor' then jsonb_build_object(
      'k', l.k, 'q', l.q, 'l', l.l, 'a', l.a, 't', l.t, 's', x.ef,
      'vt', case when x.ef in ('disp','res') then l.vt end,
      'rn', case when x.ef = 'res' then nullif(l.corretor_nome,'') end,
      'ra', case when x.ef = 'res' then l.reserva_ate end,
      'minha', case when x.ef = 'res' and l.corretor_id = p_uid then true end)
    else jsonb_build_object(
      'k', l.k, 'q', l.q, 'l', l.l, 'a', l.a, 't', l.t, 's', x.ef, 'vt', l.vt,
      'mv', case when x.ef = 'vend' then nullif(l.mv,'') end,
      'pl', case when x.ef = 'vend' then nullif(l.pl,'') end,
      'd', case when x.ef = 'vend' then l.d end,
      'vv', case when x.ef = 'vend' then l.vv end,
      'c', case when x.ef in ('vend','res') and p_role in ('admin','gestor') then nullif(l.corretor_nome,'') end,
      'ci', case when x.ef in ('vend','res') and p_role in ('admin','gestor') then l.corretor_id end,
      'rn', case when x.ef = 'res' then nullif(l.corretor_nome,'') end,
      'ra', case when x.ef = 'res' then l.reserva_ate end,
      'em', case when p_role in ('admin','gestor') then l.alterado_em end,
      'por', case when p_role in ('admin','gestor') then l.alterado_por end)
    end) order by l.q, nullif(substring(l.l from '^[0-9]+'), '')::int nulls last, l.l), '[]'::jsonb)
  from public.lotes l cross join lateral (select public._st(l.s, l.reserva_ate) as ef) x
  where l.emp_id = p_emp
$$;

--
-- Name: _nova_versao(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._nova_versao(p_emp text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare e public.emps; v_precos jsonb;
begin
  select * into e from public.emps where id = p_emp;
  if e.id is null then return; end if;
  select coalesce(jsonb_agg(jsonb_build_object('k', k, 'q', q, 'l', l, 'a', a, 'vt', vt, 't', t) order by q, l), '[]'::jsonb) into v_precos from public.lotes where emp_id = p_emp;
  if jsonb_array_length(e.planos) > 0 and jsonb_array_length(v_precos) > 0 then
    update public.emps set tabela_versoes = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select x from jsonb_array_elements(jsonb_build_array(jsonb_build_object('desde', coalesce(e.tabela_desde, e.fonte_em, e.criado_em), 'ate', now(), 'planos', e.planos, 'precos', v_precos)) || e.tabela_versoes) with ordinality t(x, o)
        order by o limit 30) s)
    where id = p_emp;
  end if;
  update public.emps set tabela_desde = now() where id = p_emp;
end $$;

--
-- Name: _st(text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._st(p_s text, p_reserva timestamp with time zone) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select case when p_s = 'res' and p_reserva is not null and p_reserva < now() then 'disp' else p_s end
$$;

--
-- Name: _total_div(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._total_div(p_div jsonb) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(sum((d->>'p')::numeric), 0) from jsonb_array_elements(coalesce(p_div, '[]'::jsonb)) d
$$;

--
-- Name: cancelar_reserva(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancelar_reserva(p_emp text, p_k text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v public.perfis; n int;
begin
  v := public._exigir(array['admin','gestor','corretor']);
  update public.lotes set s = 'disp', corretor_id = null, corretor_nome = '', reserva_ate = null, alterado_em = now(), alterado_por = v.email
  where emp_id = p_emp and k = p_k and s = 'res' and (v.role <> 'corretor' or corretor_id = v.user_id) and public.pode_ver_emp(p_emp);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Não há reserva sua neste lote.'; end if;
  update public.emps set fonte_em = now() where id = p_emp;
  perform public._evento(p_emp, p_k, 'reserva_cancelada', v.nome);
end $$;

--
-- Name: definir_mapa(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.definir_mapa(p_emp text, p_path text, p_w integer, p_h integer) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare antigo text; nome_emp text;
begin
  perform public._exigir(array['admin']);
  if not public.pode_editar_emp(p_emp) then raise exception 'Empreendimento não encontrado.'; end if;
  if split_part(p_path, '/', 1) <> p_emp then raise exception 'Caminho do mapa inválido.'; end if;
  if not (p_w between 1 and 20000 and p_h between 1 and 20000) then raise exception 'Tamanho do mapa inválido.'; end if;
  select mapa_path, nome into antigo, nome_emp from public.emps where id = p_emp;
  update public.emps set mapa_path = p_path, mapa_w = p_w, mapa_h = p_h where id = p_emp;
  perform public._log('mapa_enviado', nome_emp);
  return antigo;
end $$;

--
-- Name: desativar_link_consulta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desativar_link_consulta() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin']);
  delete from privado.config where key = 'consulta_hash';
  perform public._log('link_consulta_desativado', 'Link de consulta desativado');
end $$;

--
-- Name: excluir_arquivo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.excluir_arquivo(p_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v public.arquivos; v_nome_emp text;
begin
  perform public._exigir(array['admin']);
  delete from public.arquivos where id = p_id returning * into v;
  if v.id is null then raise exception 'Arquivo não encontrado.'; end if;
  select nome into v_nome_emp from public.emps where id = v.emp_id;
  perform public._log('arquivo_excluido', coalesce(v_nome_emp,'') || ' · ' || v.nome);
  return v.path;
end $$;

--
-- Name: excluir_emp(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.excluir_emp(p_emp text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_path text; v_nome text; v_arqs json;
begin
  perform public._exigir(array['admin']);
  select coalesce(json_agg(path), '[]'::json) into v_arqs from public.arquivos where emp_id = p_emp;
  delete from public.emps where id = p_emp returning mapa_path, nome into v_path, v_nome;
  if v_nome is null then raise exception 'Empreendimento não encontrado.'; end if;
  perform public._log('empreendimento_excluido', v_nome);
  return json_build_object('mapa', v_path, 'arquivos', v_arqs);
end $$;

--
-- Name: excluir_lote(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.excluir_lote(p_emp text, p_k text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v public.lotes;
begin
  perform public._exigir(array['admin']);
  select * into v from public.lotes where emp_id = p_emp and k = p_k;
  if v.k is null then raise exception 'Lote não encontrado.'; end if;
  if public._st(v.s, v.reserva_ate) <> 'disp' then raise exception 'Só dá para excluir lote disponível. Devolva o lote para disponível antes.'; end if;
  delete from public.lotes where emp_id = p_emp and k = p_k;
  update public.emps set fonte_em = now() where id = p_emp;
  perform public._evento(p_emp, p_k, 'lote_excluido', '');
end $$;

--
-- Name: excluir_versao_tabela(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.excluir_versao_tabela(p_emp text, p_idx integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_nome text;
begin
  perform public._exigir(array['admin']);
  update public.emps set tabela_versoes = tabela_versoes - p_idx where id = p_emp returning nome into v_nome;
  if v_nome is null then raise exception 'Empreendimento não encontrado.'; end if;
  perform public._log('versao_tabela_excluida', v_nome);
end $$;

--
-- Name: exportar_backup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.exportar_backup() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin']);
  return json_build_object(
    'gerado_em', now(),
    'emps', (select coalesce(json_agg(to_jsonb(e)), '[]'::json) from public.emps e),
    'lotes', (select coalesce(json_agg(to_jsonb(l)), '[]'::json) from public.lotes l),
    'arquivos', (select coalesce(json_agg(to_jsonb(a)), '[]'::json) from public.arquivos a),
    'usuarios', (select coalesce(json_agg(json_build_object('id', p.user_id, 'nome', p.nome, 'email', p.email, 'perfil', p.role, 'todos_emps', p.all_emps,
        'ativo', p.ativo, 'emps', (select coalesce(json_agg(u.emp_id), '[]'::json) from public.user_emps u where u.user_id = p.user_id))), '[]'::json) from public.perfis p),
    'historico_lotes', (select coalesce(json_agg(x), '[]'::json) from (select at, emp_id, k, email, evento, detalhe from public.lote_eventos order by id desc limit 20000) x),
    'acessos', (select coalesce(json_agg(x), '[]'::json) from (select at, email, evento, detalhe from public.acessos order by id desc limit 5000) x)
  );
end $$;

--
-- Name: gerar_link_consulta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_link_consulta() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare v text;
begin
  perform public._exigir(array['admin']);
  v := encode(extensions.gen_random_bytes(18), 'hex');
  insert into privado.config(key, value) values ('consulta_hash', encode(extensions.digest(v, 'sha256'), 'hex'))
  on conflict (key) do update set value = excluded.value;
  perform public._log('link_consulta_gerado', 'Novo link de consulta');
  return v;
end $$;

--
-- Name: historico_lote(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.historico_lote(p_emp text, p_k text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin','gestor']);
  if not public.pode_ver_emp(p_emp) then raise exception 'Empreendimento não encontrado.'; end if;
  return coalesce((select json_agg(x) from (select at, email, evento, detalhe from public.lote_eventos
    where emp_id = p_emp and k = p_k order by id desc limit 50) x), '[]'::json);
end $$;

--
-- Name: importar_lotes(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.importar_lotes(p_emp text, p_lotes jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare x jsonb; v_k text; n_novos int := 0; n_atual int := 0; n_rem int := 0; n_mant int := 0; v_mudou boolean;
begin
  perform public._exigir(array['admin']);
  if not exists (select 1 from public.emps where id = p_emp) then raise exception 'Empreendimento não encontrado.'; end if;
  if jsonb_typeof(p_lotes) <> 'array' or jsonb_array_length(p_lotes) = 0 then raise exception 'A lista de lotes está vazia.'; end if;
  create temp table _novos(k text primary key, q text, l text, a numeric, vt numeric, t text) on commit drop;
  for x in select * from jsonb_array_elements(p_lotes) loop
    if coalesce(trim(x->>'q'),'') = '' or coalesce(trim(x->>'l'),'') = '' then continue; end if;
    v_k := upper(trim(x->>'q')) || '-' || upper(trim(x->>'l'));
    insert into _novos values (v_k, upper(trim(x->>'q')), upper(trim(x->>'l')), (x->>'a')::numeric, (x->>'vt')::numeric, left(coalesce(x->>'t',''),40))
    on conflict (k) do update set a = excluded.a, vt = excluded.vt, t = excluded.t;
  end loop;
  select exists (select 1 from _novos n join public.lotes l on l.emp_id = p_emp and l.k = n.k where l.vt is distinct from n.vt or l.a is distinct from n.a) into v_mudou;
  if v_mudou then perform public._nova_versao(p_emp); end if;
  select count(*) into n_novos from _novos n where not exists (select 1 from public.lotes l where l.emp_id = p_emp and l.k = n.k);
  select count(*) into n_atual from _novos n join public.lotes l on l.emp_id = p_emp and l.k = n.k where l.vt is distinct from n.vt or l.a is distinct from n.a or l.t is distinct from n.t;
  insert into public.lotes(emp_id, k, q, l, a, vt, t, alterado_em, alterado_por)
  select p_emp, k, q, l, a, vt, coalesce(t,''), now(), 'importação' from _novos
  on conflict (emp_id, k) do update set a = excluded.a, vt = excluded.vt, t = excluded.t;
  with sai as (delete from public.lotes l where l.emp_id = p_emp and not exists (select 1 from _novos n where n.k = l.k)
               and public._st(l.s, l.reserva_ate) = 'disp' returning 1) select count(*) into n_rem from sai;
  select count(*) into n_mant from public.lotes l where l.emp_id = p_emp and not exists (select 1 from _novos n where n.k = l.k);
  update public.emps set fonte_em = now(), tabela_desde = coalesce(tabela_desde, now()) where id = p_emp;
  perform public._log('lotes_importados', (select nome from public.emps where id = p_emp) || ' · ' || n_novos || ' novos, ' || n_atual || ' alterados, ' || n_rem || ' removidos');
  return json_build_object('novos', n_novos, 'alterados', n_atual, 'removidos', n_rem, 'mantidos', n_mant);
end $$;

--
-- Name: lancar_lote(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lancar_lote(p_emp text, p_k text, p jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v public.perfis; l public.lotes; v_s text := p->>'s'; v_cor public.perfis; v_det text;
begin
  v := public._exigir(array['admin','gestor']);
  if not public.pode_ver_emp(p_emp) then raise exception 'Empreendimento não encontrado.'; end if;
  select * into l from public.lotes where emp_id = p_emp and k = p_k for update;
  if l.k is null then raise exception 'Lote não encontrado.'; end if;
  if v_s not in ('disp','res','vend','indisp') then raise exception 'Situação inválida.'; end if;
  if v_s in ('vend','res') then
    select * into v_cor from public.perfis where user_id = nullif(p->>'corretor','')::uuid and role = 'corretor' and ativo;
    if v_cor.user_id is null then raise exception 'Escolha um corretor cadastrado no sistema.'; end if;
  end if;
  if v_s = 'vend' then
    if coalesce(p->>'mv','') not in ('À VISTA','PARCELADO') then raise exception 'Escolha se a venda foi à vista ou parcelada.'; end if;
    if nullif(p->>'d','') is null then raise exception 'Informe a data da venda.'; end if;
    if coalesce((p->>'vv')::numeric, 0) <= 0 then raise exception 'Informe o valor da venda.'; end if;
    update public.lotes set s = 'vend', mv = p->>'mv', pl = left(coalesce(p->>'pl',''),40), corretor_id = v_cor.user_id, corretor_nome = v_cor.nome,
      d = (p->>'d')::date, vv = round((p->>'vv')::numeric, 2), reserva_ate = null, alterado_em = now(), alterado_por = v.email
    where emp_id = p_emp and k = p_k;
    v_det := 'vendido · ' || (p->>'mv') || coalesce(' · ' || nullif(p->>'pl',''), '') || ' · ' || v_cor.nome || ' · R$ ' || (p->>'vv');
  elsif v_s = 'res' then
    update public.lotes set s = 'res', corretor_id = v_cor.user_id, corretor_nome = v_cor.nome, reserva_ate = now() + interval '48 hours',
      mv = '', pl = '', d = null, vv = null, ct = false, ep = false, nf = '', dnf = null, pago = false, dp = null, alterado_em = now(), alterado_por = v.email
    where emp_id = p_emp and k = p_k;
    v_det := 'em negociação · ' || v_cor.nome || ' · 48 horas';
  else
    update public.lotes set s = v_s, corretor_id = null, corretor_nome = '', reserva_ate = null,
      mv = '', pl = '', d = null, vv = null, ct = false, ep = false, nf = '', dnf = null, pago = false, dp = null, alterado_em = now(), alterado_por = v.email
    where emp_id = p_emp and k = p_k;
    v_det := case v_s when 'disp' then 'disponível' else 'indisponível' end;
  end if;
  update public.emps set fonte_em = now() where id = p_emp;
  perform public._evento(p_emp, p_k, 'situacao', v_det);
end $_$;

--
-- Name: listar_acessos(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listar_acessos(p_lim integer DEFAULT 500) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin']);
  return coalesce((select json_agg(x) from (select at, email, evento, detalhe from public.acessos order by id desc limit least(greatest(p_lim,1),1000)) x), '[]'::json);
end $$;

--
-- Name: listar_arquivos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listar_arquivos() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v public.perfis;
begin
  v := public._exigir(array['admin','gestor','empreendedor','corretor']);
  -- administrador e gestor veem todos os arquivos; os demais, só plantas e mapas
  return coalesce((select json_agg(json_build_object('id', a.id, 'emp', a.emp_id, 'nome', a.nome, 'categoria', a.categoria, 'path', a.path,
      'tamanho', a.tamanho, 'mime', a.mime, 'anexo', a.anexo_tabela, 'em', a.criado_em) order by a.criado_em desc)
    from public.arquivos a where public.pode_ver_emp(a.emp_id)
      and (v.role in ('admin','gestor') or a.anexo_tabela or lower(a.categoria) in ('planta','mapa'))), '[]'::json);
end $$;

--
-- Name: listar_corretores(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listar_corretores() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin','gestor']);
  return coalesce((select json_agg(json_build_object('id', user_id, 'nome', nome) order by lower(nome))
    from public.perfis where role = 'corretor' and ativo), '[]'::json);
end $$;

--
-- Name: listar_emps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listar_emps() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v public.perfis;
begin
  v := public._exigir(array['admin','gestor','empreendedor','corretor']);
  return coalesce((select json_agg(json_build_object(
      'id', e.id, 'nome', e.nome, 'cidade', e.cidade, 'sigla', e.sigla, 'empreendedor', e.empreendedor,
      'planos', e.planos,
      'comissaoDiv', case when v.role in ('admin','gestor') then e.comissao_div else null end,
      'lotes', public._lotes_json(e.id, v.role, v.user_id),
      'comissao', case when v.role in ('admin','gestor') then public._comissao_json(e.id)
                       when v.role = 'empreendedor' then jsonb_build_object('totalGerado',
                         (select coalesce(sum(l.vv), 0) from public.lotes l where l.emp_id = e.id and l.s = 'vend') * public._total_div(e.comissao_div))
                       else null end,
      'tabelaDesde', e.tabela_desde, 'tabelaNotas', '[]'::jsonb,
      'tabelaVersoes', case when v.role = 'corretor' then '[]'::jsonb else
        (select coalesce(jsonb_agg(jsonb_build_object('desde', x->'desde', 'ate', x->'ate')), '[]'::jsonb) from jsonb_array_elements(e.tabela_versoes) x) end,
      'pos', e.pos, 'markerR', e.marker_r,
      'mapa', case when e.mapa_path is null then null else json_build_object('path', e.mapa_path, 'w', e.mapa_w, 'h', e.mapa_h) end,
      'fonte', case when e.fonte_em is null then null else json_build_object('em', e.fonte_em) end
    ) order by lower(e.nome)) from public.emps e where public.pode_ver_emp(e.id)), '[]'::json);
end $$;

--
-- Name: listar_usuarios(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listar_usuarios() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin']);
  return coalesce((select json_agg(json_build_object(
    'id', p.user_id, 'nome', p.nome, 'email', p.email, 'role', p.role, 'allEmps', p.all_emps,
    'ativo', p.ativo, 'trocarSenha', p.must_change, 'senhaExpira', p.senha_expira, 'criadoEm', p.criado_em, 'ultimoAcesso', p.ultimo_acesso,
    'emps', coalesce((select json_agg(u.emp_id) from public.user_emps u where u.user_id = p.user_id), '[]'::json)
  ) order by lower(p.nome)) from public.perfis p), '[]'::json);
end $$;

--
-- Name: marcar_anexo(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_anexo(p_id uuid, p_anexo boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_emp text;
begin
  perform public._exigir(array['admin']);
  select emp_id into v_emp from public.arquivos where id = p_id;
  if v_emp is null or not public.pode_editar_emp(v_emp) then raise exception 'Arquivo não encontrado.'; end if;
  if p_anexo then update public.arquivos set anexo_tabela = false where emp_id = v_emp; end if;
  update public.arquivos set anexo_tabela = p_anexo where id = p_id;
end $$;

--
-- Name: marcar_comissao(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_comissao(p_emp text, p_k text, p jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin']);
  update public.lotes set
    ct   = case when p ? 'ct'   then coalesce((p->>'ct')::boolean, false) else ct end,
    ep   = case when p ? 'ep'   then coalesce((p->>'ep')::boolean, false) else ep end,
    nf   = case when p ? 'nf'   then left(coalesce(p->>'nf',''), 40) else nf end,
    dnf  = case when p ? 'dnf'  then nullif(p->>'dnf','')::date else dnf end,
    pago = case when p ? 'pago' then coalesce((p->>'pago')::boolean, false) else pago end,
    dp   = case when p ? 'dp'   then nullif(p->>'dp','')::date else dp end
  where emp_id = p_emp and k = p_k and s = 'vend';
  if not found then raise exception 'Venda não encontrada.'; end if;
  perform public._evento(p_emp, p_k, 'comissao', p::text);
end $$;

--
-- Name: meu_perfil(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meu_perfil() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object('id', user_id, 'nome', nome, 'email', email, 'role', role, 'trocarSenha', must_change,
    'senhaExpirada', must_change and senha_expira is not null and senha_expira < now())
  from public.perfis where user_id = auth.uid() and ativo
$$;

--
-- Name: pode_editar_emp(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pode_editar_emp(p_emp text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.pode_ver_emp(p_emp) and exists (select 1 from public.perfis p where p.user_id = auth.uid() and p.role = 'admin')
$$;

--
-- Name: pode_ver_emp(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pode_ver_emp(p_emp text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.perfis p where p.user_id = auth.uid() and p.ativo and not p.must_change
    and (p.role in ('admin','corretor') or p.all_emps or exists (select 1 from public.user_emps u where u.user_id = p.user_id and u.emp_id = p_emp)))
$$;

--
-- Name: reajustar_precos(text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reajustar_precos(p_emp text, p_pct numeric) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  perform public._exigir(array['admin']);
  if p_pct is null or p_pct <= -90 or p_pct > 500 then raise exception 'Percentual de reajuste inválido.'; end if;
  perform public._nova_versao(p_emp);
  update public.lotes set vt = round(vt * (1 + p_pct / 100), 2) where emp_id = p_emp and vt is not null;
  get diagnostics n = row_count;
  update public.emps set fonte_em = now() where id = p_emp;
  perform public._log('precos_reajustados', (select nome from public.emps where id = p_emp) || ' · ' || p_pct || '%');
  return n;
end $$;

--
-- Name: registrar_acesso(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_acesso(p_evento text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_evento not in ('login','logout') then return; end if;
  if p_evento = 'login' then update public.perfis set ultimo_acesso = now() where user_id = auth.uid(); end if;
  perform public._log(p_evento);
end $$;

--
-- Name: registrar_arquivo(text, text, text, text, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_arquivo(p_emp text, p_nome text, p_categoria text, p_path text, p_tamanho bigint, p_mime text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid; v_nome_emp text;
begin
  perform public._exigir(array['admin']);
  if not public.pode_editar_emp(p_emp) then raise exception 'Empreendimento não encontrado.'; end if;
  if split_part(p_path, '/', 1) <> p_emp then raise exception 'Caminho do arquivo inválido.'; end if;
  insert into public.arquivos(emp_id, nome, categoria, path, tamanho, mime, criado_por)
  values (p_emp, left(p_nome, 200), left(coalesce(nullif(p_categoria,''),'Outro'), 40), p_path, p_tamanho, left(p_mime, 100), auth.uid()) returning id into v_id;
  select nome into v_nome_emp from public.emps where id = p_emp;
  perform public._log('arquivo_enviado', v_nome_emp || ' · ' || left(p_nome, 200));
  return v_id;
end $$;

--
-- Name: reservar_lote(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reservar_lote(p_emp text, p_k text) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v public.perfis; v_ate timestamptz;
begin
  v := public._exigir(array['corretor']);
  update public.lotes set s = 'res', corretor_id = v.user_id, corretor_nome = v.nome, reserva_ate = now() + interval '48 hours',
    mv = '', pl = '', d = null, vv = null, alterado_em = now(), alterado_por = v.email
  where emp_id = p_emp and k = p_k and public._st(s, reserva_ate) = 'disp' and public.pode_ver_emp(p_emp)
  returning reserva_ate into v_ate;
  if v_ate is null then raise exception 'Este lote não está mais disponível. Outro corretor pode ter reservado agora há pouco.'; end if;
  update public.emps set fonte_em = now() where id = p_emp;
  perform public._evento(p_emp, p_k, 'reserva', 'em negociação · ' || v.nome || ' · 48 horas');
  return v_ate;
end $$;

--
-- Name: salvar_emp(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_emp(p jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare v_id text := p->>'id'; v_old public.emps; v_planos jsonb; v_div jsonb;
begin
  perform public._exigir(array['admin']);
  if coalesce(v_id,'') !~ '^[a-z0-9-]{1,60}$' then raise exception 'Identificação do empreendimento inválida.'; end if;
  if coalesce(trim(p->>'nome'),'') = '' then raise exception 'Informe o nome do empreendimento.'; end if;
  v_planos := case when jsonb_typeof(p->'planos') = 'array' then p->'planos' else '[]'::jsonb end;
  v_div := case when jsonb_typeof(p->'comissaoDiv') = 'array' then p->'comissaoDiv' else '[]'::jsonb end;
  if exists (select 1 from jsonb_array_elements(v_div) d where coalesce(d->>'f','') = '' or (d->>'p')::numeric < 0 or (d->>'p')::numeric > 1) then
    raise exception 'Confira as partes da comissão: cada uma precisa de nome e de um percentual entre 0 e 100%%.';
  end if;
  select * into v_old from public.emps where id = v_id;
  if v_old.id is null then
    if coalesce((p->>'novo')::boolean, false) is not true then raise exception 'Empreendimento não encontrado.'; end if;
    insert into public.emps(id, nome, cidade, sigla, empreendedor, planos, comissao_div, fonte_em, tabela_desde)
    values (v_id, left(trim(p->>'nome'),120), left(coalesce(p->>'cidade',''),120), left(upper(coalesce(p->>'sigla','')),20), left(coalesce(p->>'empreendedor',''),120), v_planos, v_div, now(), now());
    perform public._log('empreendimento_criado', p->>'nome');
  else
    if v_old.planos is distinct from v_planos then perform public._nova_versao(v_id); end if;
    update public.emps set nome = left(trim(p->>'nome'),120), cidade = left(coalesce(p->>'cidade',''),120),
      sigla = left(upper(coalesce(p->>'sigla','')),20), empreendedor = left(coalesce(p->>'empreendedor',''),120),
      planos = v_planos, comissao_div = v_div, fonte_em = now()
    where id = v_id;
    perform public._log('empreendimento_alterado', p->>'nome');
  end if;
  return v_id;
end $_$;

--
-- Name: salvar_lote(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_lote(p_emp text, p jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_k text; v_old public.lotes;
begin
  perform public._exigir(array['admin']);
  if not exists (select 1 from public.emps where id = p_emp) then raise exception 'Empreendimento não encontrado.'; end if;
  if coalesce(trim(p->>'q'),'') = '' or coalesce(trim(p->>'l'),'') = '' then raise exception 'Informe a quadra e o lote.'; end if;
  v_k := upper(trim(p->>'q')) || '-' || upper(trim(p->>'l'));
  select * into v_old from public.lotes where emp_id = p_emp and k = v_k;
  if v_old.k is not null and (v_old.vt is distinct from (p->>'vt')::numeric or v_old.a is distinct from (p->>'a')::numeric) then perform public._nova_versao(p_emp); end if;
  insert into public.lotes(emp_id, k, q, l, a, vt, t, alterado_em, alterado_por)
  values (p_emp, v_k, upper(trim(p->>'q')), upper(trim(p->>'l')), (p->>'a')::numeric, (p->>'vt')::numeric, left(coalesce(p->>'t',''),40), now(), (select email from public.perfis where user_id = auth.uid()))
  on conflict (emp_id, k) do update set a = excluded.a, vt = excluded.vt, t = excluded.t;
  update public.emps set fonte_em = now() where id = p_emp;
  perform public._evento(p_emp, v_k, case when v_old.k is null then 'lote_criado' else 'lote_alterado' end, 'área ' || coalesce(p->>'a','') || ' · preço ' || coalesce(p->>'vt',''));
end $$;

--
-- Name: salvar_pos(text, jsonb, real); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_pos(p_emp text, p_pos jsonb, p_r real) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin']);
  if not public.pode_editar_emp(p_emp) then raise exception 'Empreendimento não encontrado.'; end if;
  if jsonb_typeof(p_pos) <> 'object' then raise exception 'Marcação inválida.'; end if;
  update public.emps set pos = p_pos, marker_r = case when p_r > 0 and p_r < 1000 then p_r else null end where id = p_emp;
end $$;

--
-- Name: srv_consulta_dados(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.srv_consulta_dados() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(json_agg(json_build_object(
    'id', e.id, 'nome', e.nome, 'cidade', e.cidade, 'planos', e.planos,
    'lotes', public._lotes_json(e.id, 'corretor', null),
    'pos', e.pos, 'markerR', e.marker_r,
    'mapa', case when e.mapa_path is null then null else json_build_object('path', e.mapa_path, 'w', e.mapa_w, 'h', e.mapa_h) end,
    'tabelaDesde', e.tabela_desde, 'fonteEm', e.fonte_em,
    'arquivos', (select coalesce(json_agg(json_build_object('id', a.id, 'nome', a.nome, 'categoria', a.categoria, 'path', a.path, 'mime', a.mime, 'anexo', a.anexo_tabela, 'tamanho', a.tamanho) order by a.criado_em desc), '[]'::json)
        from public.arquivos a where a.emp_id = e.id and (a.anexo_tabela or lower(a.categoria) in ('planta','mapa')))
  ) order by lower(e.nome)), '[]'::json) from public.emps e
$$;

--
-- Name: srv_consulta_hash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.srv_consulta_hash() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'privado'
    AS $$ select value from privado.config where key = 'consulta_hash' $$;

--
-- Name: srv_log(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.srv_log(p_user uuid, p_email text, p_evento text, p_detalhe text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.acessos(user_id, email, evento, detalhe) values (p_user, p_email, p_evento, left(coalesce(p_detalhe,''),500))
$$;

--
-- Name: srv_log_consulta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.srv_log_consulta() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.acessos(email, evento, detalhe) values ('link de consulta', 'consulta', 'Acesso pelo link de consulta')
$$;

--
-- Name: status_consulta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.status_consulta() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin']);
  return json_build_object('ativo', exists(select 1 from privado.config where key = 'consulta_hash'),
    'acessos7d', (select count(*) from public.acessos where evento = 'consulta' and at > now() - interval '7 days'));
end $$;

--
-- Name: tabela_versao(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tabela_versao(p_emp text, p_idx integer) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public._exigir(array['admin','gestor','empreendedor']);
  if not public.pode_ver_emp(p_emp) then raise exception 'Empreendimento não encontrado.'; end if;
  return (select (tabela_versoes->p_idx)::json from public.emps where id = p_emp);
end $$;

--
-- Name: config; Type: TABLE; Schema: privado; Owner: -
--

CREATE TABLE privado.config (
    key text NOT NULL,
    value text NOT NULL
);

--
-- Name: acessos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acessos (
    id bigint NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    email text,
    evento text NOT NULL,
    detalhe text
);

--
-- Name: acessos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.acessos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: acessos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.acessos_id_seq OWNED BY public.acessos.id;

--
-- Name: arquivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arquivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    emp_id text NOT NULL,
    nome text NOT NULL,
    categoria text DEFAULT 'Outro'::text NOT NULL,
    path text NOT NULL,
    tamanho bigint,
    mime text,
    anexo_tabela boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    criado_por uuid
);

--
-- Name: emps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emps (
    id text NOT NULL,
    nome text NOT NULL,
    cidade text DEFAULT ''::text NOT NULL,
    empreendedor text DEFAULT ''::text NOT NULL,
    pos jsonb DEFAULT '{}'::jsonb NOT NULL,
    marker_r real,
    mapa_path text,
    mapa_w integer,
    mapa_h integer,
    fonte_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    tabela_desde timestamp with time zone,
    tabela_versoes jsonb DEFAULT '[]'::jsonb NOT NULL,
    sigla text DEFAULT ''::text NOT NULL,
    planos jsonb DEFAULT '[]'::jsonb NOT NULL,
    comissao_div jsonb DEFAULT '[]'::jsonb NOT NULL
);

--
-- Name: lote_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lote_eventos (
    id bigint NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    emp_id text NOT NULL,
    k text NOT NULL,
    user_id uuid,
    email text,
    evento text NOT NULL,
    detalhe text
);

--
-- Name: lote_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lote_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: lote_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lote_eventos_id_seq OWNED BY public.lote_eventos.id;

--
-- Name: lotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lotes (
    emp_id text NOT NULL,
    k text NOT NULL,
    q text NOT NULL,
    l text NOT NULL,
    a numeric,
    vt numeric,
    t text DEFAULT ''::text NOT NULL,
    s text DEFAULT 'disp'::text NOT NULL,
    mv text DEFAULT ''::text NOT NULL,
    pl text DEFAULT ''::text NOT NULL,
    corretor_id uuid,
    corretor_nome text DEFAULT ''::text NOT NULL,
    d date,
    vv numeric,
    reserva_ate timestamp with time zone,
    ct boolean DEFAULT false NOT NULL,
    ep boolean DEFAULT false NOT NULL,
    nf text DEFAULT ''::text NOT NULL,
    dnf date,
    pago boolean DEFAULT false NOT NULL,
    dp date,
    alterado_em timestamp with time zone,
    alterado_por text,
    CONSTRAINT lotes_s_check CHECK ((s = ANY (ARRAY['disp'::text, 'res'::text, 'vend'::text, 'indisp'::text])))
);

--
-- Name: user_emps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_emps (
    user_id uuid NOT NULL,
    emp_id text NOT NULL
);

--
-- Name: acessos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acessos ALTER COLUMN id SET DEFAULT nextval('public.acessos_id_seq'::regclass);

--
-- Name: lote_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lote_eventos ALTER COLUMN id SET DEFAULT nextval('public.lote_eventos_id_seq'::regclass);

--
-- Name: config config_pkey; Type: CONSTRAINT; Schema: privado; Owner: -
--

ALTER TABLE ONLY privado.config
    ADD CONSTRAINT config_pkey PRIMARY KEY (key);

--
-- Name: acessos acessos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acessos
    ADD CONSTRAINT acessos_pkey PRIMARY KEY (id);

--
-- Name: arquivos arquivos_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arquivos
    ADD CONSTRAINT arquivos_path_key UNIQUE (path);

--
-- Name: arquivos arquivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arquivos
    ADD CONSTRAINT arquivos_pkey PRIMARY KEY (id);

--
-- Name: emps emps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emps
    ADD CONSTRAINT emps_pkey PRIMARY KEY (id);

--
-- Name: lote_eventos lote_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lote_eventos
    ADD CONSTRAINT lote_eventos_pkey PRIMARY KEY (id);

--
-- Name: lotes lotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_pkey PRIMARY KEY (emp_id, k);

--
-- Name: perfis perfis_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfis
    ADD CONSTRAINT perfis_email_key UNIQUE (email);

--
-- Name: perfis perfis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfis
    ADD CONSTRAINT perfis_pkey PRIMARY KEY (user_id);

--
-- Name: user_emps user_emps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_emps
    ADD CONSTRAINT user_emps_pkey PRIMARY KEY (user_id, emp_id);

--
-- Name: acessos_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acessos_at ON public.acessos USING btree (at DESC);

--
-- Name: arquivos_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX arquivos_emp ON public.arquivos USING btree (emp_id);

--
-- Name: lote_eventos_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lote_eventos_lote ON public.lote_eventos USING btree (emp_id, k, at DESC);

--
-- Name: user_emps_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_emps_emp ON public.user_emps USING btree (emp_id);

--
-- Name: arquivos arquivos_emp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arquivos
    ADD CONSTRAINT arquivos_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.emps(id) ON DELETE CASCADE;

--
-- Name: lotes lotes_corretor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_corretor_id_fkey FOREIGN KEY (corretor_id) REFERENCES public.perfis(user_id) ON DELETE SET NULL;

--
-- Name: lotes lotes_emp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.emps(id) ON DELETE CASCADE;

--
-- Name: user_emps user_emps_emp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_emps
    ADD CONSTRAINT user_emps_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.emps(id) ON DELETE CASCADE;

--
-- Name: user_emps user_emps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_emps
    ADD CONSTRAINT user_emps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.perfis(user_id) ON DELETE CASCADE;

-- Senha (bcrypt) no próprio perfil, no lugar do Supabase Auth
ALTER TABLE public.perfis ADD COLUMN senha_hash text;

RESET check_function_bodies;

-- =====================================================================
-- Funções novas do servidor Next.js
-- =====================================================================

-- Quem está logado pode abrir este arquivo? (mapas e arquivos ficam no Vercel Blob, privados)
CREATE FUNCTION public.arquivo_permitido(p_bucket text, p_path text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v public.perfis;
begin
  select * into v from public.perfis where user_id = auth.uid() and ativo and not must_change;
  if v.user_id is null then return false; end if;
  if p_bucket = 'mapas' then
    return exists (select 1 from public.emps e where e.mapa_path = p_path and public.pode_ver_emp(e.id));
  elsif p_bucket = 'arquivos' then
    return exists (select 1 from public.arquivos a where a.path = p_path and public.pode_ver_emp(a.emp_id)
      and (v.role in ('admin','gestor') or a.anexo_tabela or lower(a.categoria) in ('planta','mapa')));
  end if;
  return false;
end $$;

-- Arquivos que a consulta sem login pode abrir: mapas e plantas (os mesmos de srv_consulta_dados)
CREATE FUNCTION public.srv_arquivo_consulta(p_bucket text, p_path text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case p_bucket
    when 'mapas' then exists (select 1 from public.emps where mapa_path = p_path)
    when 'arquivos' then exists (select 1 from public.arquivos a where a.path = p_path and (a.anexo_tabela or lower(a.categoria) in ('planta','mapa')))
    else false end
$$;

-- Importa a cópia de segurança do LIGA antigo (Supabase), gerada em Configurações › Cópia de segurança.
-- Grava empreendimentos, lotes, histórico dos lotes, acessos e usuários. Mapas e plantas não vêm na cópia:
-- envie de novo em Empreendimentos e em Mapas e plantas. Usuários novos entram sem senha (gere uma em Usuários).
CREATE FUNCTION public.importar_backup(p jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  eu public.perfis; u jsonb; e jsonb; v_id uuid; mapa jsonb := '{}'::jsonb;
  n_emps int := 0; n_lotes int := 0; n_users int := 0; n_ev int := 0; n_ac int := 0;
begin
  eu := public._exigir(array['admin']);
  if jsonb_typeof(p->'emps') <> 'array' or jsonb_typeof(p->'lotes') <> 'array' then
    raise exception 'Este arquivo não é uma cópia de segurança do LIGA. Baixe em Configurações › Cópia de segurança no painel antigo.';
  end if;

  -- usuários: o mesmo e-mail vira o mesmo usuário; ids antigos são trocados pelos novos
  for u in select * from jsonb_array_elements(coalesce(p->'usuarios', '[]'::jsonb)) loop
    if coalesce(u->>'email','') = '' then continue; end if;
    select user_id into v_id from public.perfis where lower(email) = lower(u->>'email');
    if v_id is null then
      insert into public.perfis(user_id, email, nome, role, all_emps, ativo, must_change)
      values (coalesce((u->>'id')::uuid, gen_random_uuid()), lower(u->>'email'), coalesce(nullif(u->>'nome',''), u->>'email'),
              case when u->>'perfil' in ('admin','gestor','empreendedor','corretor') then u->>'perfil' else 'corretor' end,
              coalesce((u->>'todos_emps')::boolean, true), coalesce((u->>'ativo')::boolean, true), true)
      on conflict (user_id) do nothing
      returning user_id into v_id;
      if v_id is null then
        insert into public.perfis(email, nome, role, all_emps, ativo, must_change)
        values (lower(u->>'email'), coalesce(nullif(u->>'nome',''), u->>'email'),
                case when u->>'perfil' in ('admin','gestor','empreendedor','corretor') then u->>'perfil' else 'corretor' end,
                coalesce((u->>'todos_emps')::boolean, true), coalesce((u->>'ativo')::boolean, true), true)
        returning user_id into v_id;
      end if;
      n_users := n_users + 1;
    end if;
    if u ? 'id' then mapa := mapa || jsonb_build_object(u->>'id', v_id::text); end if;
  end loop;

  -- empreendimentos (sem o mapa: a imagem é enviada de novo)
  for e in select * from jsonb_array_elements(p->'emps') loop
    insert into public.emps(id, nome, cidade, empreendedor, sigla, planos, comissao_div, pos, marker_r, mapa_w, mapa_h,
                            fonte_em, criado_em, tabela_desde, tabela_versoes)
    values (e->>'id', e->>'nome', coalesce(e->>'cidade',''), coalesce(e->>'empreendedor',''), coalesce(e->>'sigla',''),
            coalesce(e->'planos','[]'::jsonb), coalesce(e->'comissao_div','[]'::jsonb), coalesce(e->'pos','{}'::jsonb),
            (e->>'marker_r')::real, (e->>'mapa_w')::int, (e->>'mapa_h')::int,
            (e->>'fonte_em')::timestamptz, coalesce((e->>'criado_em')::timestamptz, now()), (e->>'tabela_desde')::timestamptz,
            coalesce(e->'tabela_versoes','[]'::jsonb))
    on conflict (id) do update set nome = excluded.nome, cidade = excluded.cidade, empreendedor = excluded.empreendedor,
      sigla = excluded.sigla, planos = excluded.planos, comissao_div = excluded.comissao_div, pos = excluded.pos,
      marker_r = excluded.marker_r, fonte_em = excluded.fonte_em, tabela_desde = excluded.tabela_desde, tabela_versoes = excluded.tabela_versoes;
    n_emps := n_emps + 1;
  end loop;

  -- lotes: a cópia substitui os lotes dos empreendimentos que vieram nela
  delete from public.lotes where emp_id in (select x->>'id' from jsonb_array_elements(p->'emps') x);
  insert into public.lotes(emp_id, k, q, l, a, vt, t, s, mv, pl, corretor_id, corretor_nome, d, vv, reserva_ate,
                           ct, ep, nf, dnf, pago, dp, alterado_em, alterado_por)
  select x->>'emp_id', x->>'k', x->>'q', x->>'l', (x->>'a')::numeric, (x->>'vt')::numeric, coalesce(x->>'t',''),
         coalesce(x->>'s','disp'), coalesce(x->>'mv',''), coalesce(x->>'pl',''),
         (select user_id from public.perfis where user_id = coalesce(mapa->>(x->>'corretor_id'), x->>'corretor_id')::uuid),
         coalesce(x->>'corretor_nome',''), (x->>'d')::date, (x->>'vv')::numeric, (x->>'reserva_ate')::timestamptz,
         coalesce((x->>'ct')::boolean,false), coalesce((x->>'ep')::boolean,false), coalesce(x->>'nf',''), (x->>'dnf')::date,
         coalesce((x->>'pago')::boolean,false), (x->>'dp')::date, (x->>'alterado_em')::timestamptz, x->>'alterado_por'
  from jsonb_array_elements(p->'lotes') x
  where exists (select 1 from public.emps where id = x->>'emp_id');
  get diagnostics n_lotes = row_count;

  -- acessos de usuários a empreendimentos
  insert into public.user_emps(user_id, emp_id)
  select (mapa->>(uu->>'id'))::uuid, j #>> '{}'
  from jsonb_array_elements(coalesce(p->'usuarios','[]'::jsonb)) uu, jsonb_array_elements(coalesce(uu->'emps','[]'::jsonb)) j
  where mapa ? (uu->>'id') and exists (select 1 from public.emps where id = j #>> '{}')
  on conflict do nothing;

  -- histórico dos lotes e registro de acessos (só se ainda não foram importados)
  if not exists (select 1 from public.lote_eventos where detalhe like '%[importado]%' limit 1) then
    insert into public.lote_eventos(at, emp_id, k, email, evento, detalhe)
    select (x->>'at')::timestamptz, x->>'emp_id', x->>'k', x->>'email', x->>'evento', left(coalesce(x->>'detalhe',''), 280) || ' [importado]'
    from jsonb_array_elements(coalesce(p->'historico_lotes','[]'::jsonb)) x;
    get diagnostics n_ev = row_count;
    insert into public.acessos(at, email, evento, detalhe)
    select (x->>'at')::timestamptz, x->>'email', x->>'evento', x->>'detalhe'
    from jsonb_array_elements(coalesce(p->'acessos','[]'::jsonb)) x;
    get diagnostics n_ac = row_count;
  end if;

  perform public._log('backup_importado', n_emps || ' empreendimentos, ' || n_lotes || ' lotes, ' || n_users || ' usuários novos');
  return json_build_object('emps', n_emps, 'lotes', n_lotes, 'usuarios', n_users, 'eventos', n_ev, 'acessos', n_ac);
end $$;
