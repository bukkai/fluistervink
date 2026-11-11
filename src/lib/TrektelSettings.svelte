<script lang="ts">
  // Trektelmodus aan of uit (docs/plan-trektelmodus.md)
  import { setTrektelEnabled, trektelEnabled } from './trektel';

  let enabled = $state(trektelEnabled());

  function toggle() {
    setTrektelEnabled(enabled);
  }
</script>

<section class="card">
  <div class="card-head"><h2>Trektelmodus</h2></div>
  <div class="card-body stack">
    <label class="check">
      <input type="checkbox" bind:checked={enabled} onchange={toggle} />
      Trektelmodus (proef)
    </label>
    <p class="hint">
      Voor als je op één plek telt en de telefoon naast je legt. Tijdens een sessie verschijnt dan
      de knop "Trektelling starten": de app luistert daarna door en verwerkt alles wat je zegt,
      zonder dat je steeds hoeft te drukken. Stilte wordt niet verstuurd.
    </p>
    <p class="hint">
      Het scherm blijft aan zolang de telling loopt, dat kost accu. Ga je even naar een andere app
      (zoals Merlin) of gaat het scherm op slot, dan pauzeert de telling: de microfoon gaat uit (één
      lange tril) en weer aan als je terugkomt. Na een kwartier weg stopt de telling (twee lange
      trillen), en na vier uur stopt hij vanzelf.
    </p>
  </div>
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
