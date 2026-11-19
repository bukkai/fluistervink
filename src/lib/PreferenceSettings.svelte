<script lang="ts">
  import { t, type Key } from './i18n';
  // Keuzes voor iedereen (preferences.ts); eBird en de gesproken bevestiging
  // staan standaard uit
  import { speechSupported, volumeKeySupported } from './native';
  import { preferenceOn, setPreference, type Preference } from './preferences';

  // Eén kaart per groep; Settings.svelte zet de kaarten in volgorde, met de
  // trektelmodus en de gegevenskaarten ertussen
  type Group = 'understanding' | 'field' | 'review';

  let { group }: { group: Group } = $props();

  const GROUP_TITLES: Record<Group, Key> = {
    understanding: 'prefs.groupUnderstanding',
    field: 'prefs.groupField',
    review: 'prefs.groupReview',
  };

  interface Item {
    preference: Preference;
    group: Group;
    /** Alleen tonen als de app het kan (Android-app) */
    available?: boolean;
  }

  // Tekst en uitleg staan in het woordenboek als `prefs.<keuze>` en `prefs.<keuze>Hint`
  const items: Item[] = [
    { preference: 'soortgroepen', group: 'understanding' },
    { preference: 'zeldzaamOnzeker', group: 'understanding' },
    { preference: 'volumeknop', group: 'field', available: volumeKeySupported },
    { preference: 'gesproken', group: 'field', available: speechSupported },
    { preference: 'exportHerinnering', group: 'review' },
    { preference: 'ebird', group: 'review' },
  ];

  const shown = items.filter((item) => item.group === group && item.available !== false);
  let checked = $state(
    Object.fromEntries(items.map((item) => [item.preference, preferenceOn(item.preference)])),
  );
</script>

<!-- In de PWA heeft "Bediening in het veld" niets: dan geen lege kaart -->
{#if shown.length}
  <section class="card">
    <div class="card-head"><h2>{t(GROUP_TITLES[group])}</h2></div>
    <div class="card-body stack">
      {#each shown as item (item.preference)}
        <label class="check">
          <input
            type="checkbox"
            bind:checked={checked[item.preference]}
            onchange={() => setPreference(item.preference, checked[item.preference])}
          />
          {t(`prefs.${item.preference}`)}
        </label>
        <p class="hint">{t(`prefs.${item.preference}Hint`)}</p>
      {/each}
    </div>
  </section>
{/if}
