/**
 * Round 2 — profil sayfası H1 + Rank Math Person birleştirme (Code Snippet).
 * Canlıya ancak onay sonrası uygulanır.
 */
export const PERSON_ID = 'https://adanabosanmaavukati.org/avukat-ceren-sumer-cilli/#person';
export const PERSON_SCHEMA_NAME = 'Ceren Sümer Cilli';
export const PROFILE_URL = 'https://adanabosanmaavukati.org/avukat-ceren-sumer-cilli/';
export const CANONICAL_PERSON_URL = 'https://www.cerensumer.av.tr/av-ceren-sumer-cilli/';
export const PROFILE_PAGE_ID = 15;

export function buildEntityCleanupSnippetPhp() {
  return `<?php
/**
 * Plugin Name: CSC Round 2 entity cleanup
 * Description: Profil sayfasında tek H1; Rank Math Person @id birleştirme. Site genelinde Rank Math kapatılmaz.
 */
if (!defined('ABSPATH')) {
    exit;
}

add_filter('astra_the_title_enabled', function ($enabled) {
    if (is_page(${PROFILE_PAGE_ID}) || is_page('avukat-ceren-sumer-cilli')) {
        return false;
    }
    return $enabled;
});

add_filter('rank_math/json_ld', function ($data, $jsonld) {
    if (!is_array($data)) {
        return $data;
    }
    $person_id = '${PERSON_ID}';
    $schema_name = '${PERSON_SCHEMA_NAME}';
    $profile_url = '${PROFILE_URL}';
    $canonical = '${CANONICAL_PERSON_URL}';

    $rewrite = function ($node) use (&$rewrite, $person_id, $schema_name, $profile_url, $canonical) {
        if (!is_array($node)) {
            return $node;
        }
        $types = isset($node['@type']) ? (array) $node['@type'] : array();
        if (in_array('Person', $types, true)) {
            $id = isset($node['@id']) ? (string) $node['@id'] : '';
            $name = isset($node['name']) ? (string) $node['name'] : '';
            $looks_ceren = (stripos($name, 'Ceren') !== false)
                || (strpos($id, 'ceren') !== false)
                || (strpos($id, '/author/') !== false)
                || (strpos($id, '#schema-') !== false);
            if ($looks_ceren) {
                $node['@type'] = 'Person';
                $node['@id'] = $person_id;
                $node['name'] = $schema_name;
                if (empty($node['url']) || strpos((string) $node['url'], '/author/') !== false) {
                    $node['url'] = $profile_url;
                }
                if (empty($node['sameAs'])) {
                    $node['sameAs'] = array($canonical);
                }
            }
        }
        if (isset($node['author'])) {
            $node['author'] = $rewrite($node['author']);
        }
        if (isset($node['@graph']) && is_array($node['@graph'])) {
            $out = array();
            $seen = false;
            foreach ($node['@graph'] as $child) {
                $child = $rewrite($child);
                $c_types = is_array($child) && isset($child['@type']) ? (array) $child['@type'] : array();
                $c_id = is_array($child) && isset($child['@id']) ? $child['@id'] : '';
                if (in_array('Person', $c_types, true) && $c_id === $person_id) {
                    if ($seen) {
                        continue;
                    }
                    $seen = true;
                }
                $out[] = $child;
            }
            $node['@graph'] = $out;
        }
        return $node;
    };

    foreach ($data as $key => $piece) {
        $data[$key] = $rewrite($piece);
    }
    return $data;
}, 99, 2);
`;
}
