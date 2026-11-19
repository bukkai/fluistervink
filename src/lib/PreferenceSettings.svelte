<script lang="ts">
  import { t, type Key } from './i18n';
  // Keuzes voor iedereen (preferences.ts); eBird en de gesproken bevestiging
  // staan standaard uit
  import { speechSupported, volumeKeySupported } from './native';
  import { preferenceOn, setPreference, type Preference } from './preferences';

  type Group = 'speaking' | 'review';
  const GROUPS: Group[] = ['speaking', 'review'];
  const GROUP_TITLES: Record<Group, Key> = {
    speaking: 'prefs.groupSpeaking',
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
    { preference: 'soortgroepen', group: 'speaking' },
    { preference: 'volumeknop', group: 'speaking', available: volumeKeySupported },
    { preference: 'gesproken', group: 'speaking', available: speechSupported },
    { preference: 'zeldzaamOnzeker', group: 'speaking' },
    { preference: 'exportHerinnering', group: 'review' },
    { preference: 'ebird', group: 'review' },
  ];

  const shown = items.filter((item) => item.available !== false);
  let checked = $state(
    Object.fromEntries(items.map((item) => [item.preference, preferenceOn(item.preference)])),
  );
</script>

{#each GROUPS as group (group)}
  <section class="card">
    <div class="card-head"><h2>{t(GROUP_TITLES[group])}</h2></div>
    <div class="card-body stack">
      {#each shown.filter((item) => item.group === group) as item (item.preference)}
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
{/each}
