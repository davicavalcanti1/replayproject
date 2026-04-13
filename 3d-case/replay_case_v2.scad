/*
 * Replay MVP — Caixa Robusta V2 "ReFrame Edition"
 * =================================================
 * Caixa externa reforçada + gaiola interna parafusada pra proteger o
 * NodeMCU ESP8266. Logo ReFrame gravada no topo.
 *
 * Feito em OpenSCAD (https://openscad.org, gratuito).
 * F5 = preview rápido, F6 = render completo, F7 = exportar STL.
 *
 * ---------------------------------------------------------------------------
 * ESTRUTURA EM 4 PEÇAS IMPRIMÍVEIS:
 *
 *   1. body()        – corpo externo (paredes 5 mm, nervuras internas,
 *                      cantos r=10, buchas de parafuso reforçadas)
 *   2. main_lid()    – tampa inferior externa (countersink + gaxeta)
 *   3. cage()        – GAIOLA INTERNA parafusada que abriga o NodeMCU
 *   4. cage_lid()    – tampa da gaiola (prende o PCB por cima)
 *
 * Opcional:
 *   5. bumper()      – cantoneira externa em TPU (absorção de impacto)
 *
 * ---------------------------------------------------------------------------
 * FILAMENTO:
 *   - "PRATA" = escolha do filamento. Recomendo nesta ordem:
 *       a) ASA Silver  (melhor pro sol; não amarela; rígido)
 *       b) PETG Silver (bom compromisso, chuva/queda)
 *       c) PLA+ Silver (só uso interno/fresco)
 *     ou, pro visual "alumínio escovado": PolyTerra Aluminum ou
 *     eSun ePLA-Matte Silver.
 *
 *   - Se quiser destacar a logo: imprima em prata, depois passe tinta
 *     acrílica preta na gravação e LIMPE o excesso com álcool na superfície
 *     antes de secar (técnica de "ink fill"). Fica logo preta no fundo prata.
 *
 * ---------------------------------------------------------------------------
 * IMPRESSÃO:
 *   Body / Lid:
 *     camada: 0.2 mm | paredes: 5 | infill: 40 % gyroid | brim: 8 mm
 *     orientação body: TOPO PRA BAIXO (face com botão apoiada na mesa,
 *     assim a logo imprime perfeita sem suportes)
 *     orientação lid: lado externo pra baixo
 *   Cage / Cage_lid:
 *     camada: 0.2 mm | paredes: 4 | infill: 30 %
 *     orientação cage: abertura pra cima
 *
 * ---------------------------------------------------------------------------
 * MONTAGEM:
 *   a) Parafuse o NodeMCU dentro da gaiola (cage) — 4 × M2.5 x 6 mm
 *      nos pinos-guia (ou só encaixa pelos 4 pinos, sem parafuso).
 *   b) Feche a gaiola com cage_lid (4 × M2 x 6 mm).
 *   c) Passe fios do botão pelo furo superior da gaiola.
 *   d) Apoie a gaiola nos 4 postes internos do body e aperte os
 *      4 × M3 x 10 mm (com arruelas de borracha pra shock-isolation).
 *   e) Instale o botão arcade 30 mm pelo furo superior.
 *   f) Coloque cordão de silicone 2 mm no canal da gaxeta do body.
 *   g) Feche com main_lid (4 × M3 x 12 mm) com countersink.
 * ---------------------------------------------------------------------------
 */

// ===========================================================================
//  PARÂMETROS (ajuste aqui)
// ===========================================================================
$fn = 80;

// --- dimensões internas do CORPO externo ---
in_w = 110;                      // largura interna (X)
in_d = 90;                       // profundidade interna (Y)
in_h = 55;                       // altura interna (Z)

// --- paredes e cantos ---
wall      = 5.0;                 // parede lateral externa
floor_t   = 5.0;                 // teto e piso externos
corner_r  = 10;                  // raio arredondado externo (amortece queda)

// --- nervuras internas (reforço estrutural) ---
rib_enable = true;
rib_w      = 2.5;                // espessura da nervura
rib_spacing_z = 22;              // distância entre nervuras no eixo Z

// --- botão arcade 30 mm ---
btn_hole = 28;
btn_offset_y = -12;              // desloca o botão pra um lado; logo fica no
                                 //   outro (−12 = botão pro sul, logo pro norte)

// --- USB micro ---
usb_w  = 13;
usb_h  = 8;
usb_z  = 22;                     // altura do furo (centro)

// --- parafusos externos (main_lid <-> body) ---
ms_d       = 3.3;                // M3 clearance
ms_boss_d  = 11;                 // bucha reforçada
ms_boss_h  = 14;

// --- parafusos da gaiola (cage <-> body) ---
cs_d       = 3.3;                // M3 clearance
cs_post_d  = 8;                  // poste onde a gaiola apoia
cs_post_h  = 6;                  // altura do poste (erguer a gaiola do chão)

// --- gaiola interna ---
pcb_w = 58;                      // PCB NodeMCU
pcb_d = 31;
pcb_h = 15;                      // altura total com pinos
cage_wall = 3.0;
cage_clear_xy = 3;               // folga XY em torno do PCB
cage_clear_z  = 5;               // folga Z em cima do PCB
cage_screw_d = 3.3;              // M3 pra fixar a gaiola no body
cage_lid_screw_d = 2.2;          // M2 auto-atarrachante pra tampa da gaiola

// --- gaxeta de vedação ---
gasket_w     = 2.4;
gasket_depth = 1.5;

// --- abas externas de fixação em parede/poste (opcional) ---
ear_enable = true;
ear_l = 22;
ear_t = 6;
ear_hole = 5;

// --- logo ReFrame ---
logo_text_main  = "ReFrame";
logo_text_sub   = "SISTEMA DE REPLAY";
logo_font_main  = "Arial:style=Bold";      // fallback universal
logo_font_sub   = "Arial:style=Bold";
logo_size_main  = 14;            // mm de altura
logo_size_sub   = 5.2;
logo_depth      = 1.2;           // profundidade da gravação (mm)
logo_y_offset   = 18;            // distância do centro pro norte

// ===========================================================================
//  DERIVADOS
// ===========================================================================
out_w = in_w + 2*wall;
out_d = in_d + 2*wall;
out_h = in_h + 2*floor_t;

ms_boss_inset = wall + 5;
main_screw_pos = [
    [ms_boss_inset,          ms_boss_inset         ],
    [out_w - ms_boss_inset,  ms_boss_inset         ],
    [ms_boss_inset,          out_d - ms_boss_inset ],
    [out_w - ms_boss_inset,  out_d - ms_boss_inset ]
];

cage_out_w = pcb_w + 2*(cage_wall + cage_clear_xy);
cage_out_d = pcb_d + 2*(cage_wall + cage_clear_xy);
cage_out_h = pcb_h + cage_wall + cage_clear_z;

// Postes da gaiola — posicionados no chão interno do body, centralizados
cage_posts = let (
    cx = out_w/2,
    cy = out_d/2 + 10,           // gaiola um pouco pro norte (longe do botão)
    dx = cage_out_w/2 - 4,
    dy = cage_out_d/2 - 4
) [
    [cx - dx, cy - dy],
    [cx + dx, cy - dy],
    [cx - dx, cy + dy],
    [cx + dx, cy + dy]
];

// ===========================================================================
//  HELPERS
// ===========================================================================
module rounded_box(w, d, h, r) {
    hull() for (x=[r,w-r], y=[r,d-r])
        translate([x,y,0]) cylinder(r=r, h=h);
}

module rounded_box_safe(w, d, h, r) {
    rr = min(r, w/2 - 0.1, d/2 - 0.1);
    hull() for (x=[rr, w-rr], y=[rr, d-rr])
        translate([x,y,0]) cylinder(r=max(rr, 0.1), h=h);
}

module ear() {
    translate([0, -ear_l/2, 0])
        difference() {
            hull() {
                cylinder(d=ear_l, h=ear_t);
                translate([ear_l*0.65, 0, 0])
                    cube([0.1, ear_l, ear_t]);
            }
            translate([ear_l/2, 0, -0.1])
                cylinder(d=ear_hole, h=ear_t+0.2);
        }
}

// Nervuras internas verticais em "X" nas 4 paredes
module internal_ribs() {
    if (rib_enable) {
        // paredes curtas (Y): X=wall e X=out_w-wall
        for (x = [wall + 0.1, out_w - wall - rib_w - 0.1])
            for (z = [floor_t + 4 : rib_spacing_z : out_h - floor_t - 8]) {
                translate([x, wall + 2, z])
                    cube([rib_w, in_d - 4, rib_w]);
            }
        // paredes longas (X): Y=wall e Y=out_d-wall
        for (y = [wall + 0.1, out_d - wall - rib_w - 0.1])
            for (z = [floor_t + 4 : rib_spacing_z : out_h - floor_t - 8]) {
                translate([wall + 2, y, z])
                    cube([in_w - 4, rib_w, rib_w]);
            }
    }
}

// ===========================================================================
//  LOGO (texto gravado)
// ===========================================================================
module logo_negative() {
    // "ReFrame" grande
    translate([out_w/2, out_d/2 + logo_y_offset, out_h - logo_depth])
        linear_extrude(height = logo_depth + 0.2)
            text(logo_text_main,
                 size   = logo_size_main,
                 font   = logo_font_main,
                 halign = "center",
                 valign = "center");

    // "SISTEMA DE REPLAY"
    translate([out_w/2, out_d/2 + logo_y_offset - logo_size_main*0.85,
               out_h - logo_depth])
        linear_extrude(height = logo_depth + 0.2)
            text(logo_text_sub,
                 size   = logo_size_sub,
                 font   = logo_font_sub,
                 halign = "center",
                 valign = "center");
}

// ===========================================================================
//  BODY — corpo externo
// ===========================================================================
module body() {
    difference() {
        union() {
            // casca externa (topo fechado, fundo aberto)
            difference() {
                rounded_box(out_w, out_d, out_h, corner_r);
                translate([wall, wall, -0.01])
                    rounded_box_safe(
                        in_w, in_d, out_h - floor_t + 0.02,
                        corner_r - wall
                    );
            }

            // buchas reforçadas de parafuso (main_lid)
            for (p = main_screw_pos)
                translate([p.x, p.y, 0])
                    cylinder(d=ms_boss_d, h=ms_boss_h);

            // postes internos para a gaiola
            for (p = cage_posts)
                translate([p.x, p.y, 0])
                    cylinder(d=cs_post_d + 2, h=cs_post_h);

            // nervuras internas
            internal_ribs();

            // abas laterais
            if (ear_enable) {
                translate([0,     out_d/2, 0]) rotate([0,0,180]) ear();
                translate([out_w, out_d/2, 0]) ear();
            }
        }

        // furo do botão arcade no topo
        translate([out_w/2, out_d/2 + btn_offset_y, out_h - floor_t - 0.1])
            cylinder(d=btn_hole, h=floor_t + 1);

        // chanfro decorativo 1 mm
        translate([out_w/2, out_d/2 + btn_offset_y, out_h - 1.0])
            cylinder(d1=btn_hole, d2=btn_hole + 2, h=1.01);

        // USB lateral (−X)
        translate([-0.1, out_d/2 - usb_w/2, usb_z])
            cube([wall + 0.2, usb_w, usb_h]);

        // furos M3 (main_lid)
        for (p = main_screw_pos)
            translate([p.x, p.y, -0.1])
                cylinder(d=ms_d, h=ms_boss_h + 0.2);

        // furos M3 (cage) — furam o poste de cima pra baixo, só parcial
        for (p = cage_posts)
            translate([p.x, p.y, cs_post_h - 8])
                cylinder(d=cs_d, h=10);

        // canal de gaxeta na base
        translate([wall + gasket_w, wall + gasket_w, -0.01])
            difference() {
                rounded_box_safe(
                    in_w - 2*gasket_w, in_d - 2*gasket_w,
                    gasket_depth, corner_r - wall - gasket_w
                );
                translate([gasket_w, gasket_w, -0.02])
                    rounded_box_safe(
                        in_w - 4*gasket_w, in_d - 4*gasket_w,
                        gasket_depth + 0.1, corner_r - wall - 2*gasket_w
                    );
            }

        // ========== LOGO REFRAME GRAVADA NO TOPO ==========
        logo_negative();
    }
}

// ===========================================================================
//  MAIN_LID — tampa inferior do corpo
// ===========================================================================
module main_lid() {
    lt = floor_t;

    difference() {
        union() {
            rounded_box(out_w, out_d, lt, corner_r);

            // lip de alinhamento (entra no body)
            translate([wall + 0.4, wall + 0.4, lt - 0.01])
                difference() {
                    rounded_box_safe(
                        in_w - 0.8, in_d - 0.8, 2.5,
                        max(0.3, corner_r - wall)
                    );
                    translate([1.5, 1.5, -0.1])
                        rounded_box_safe(
                            in_w - 3.8, in_d - 3.8, 2.8,
                            max(0.2, corner_r - wall - 1.5)
                        );
                }
        }

        // parafusos M3 com countersink
        for (p = main_screw_pos) {
            translate([p.x, p.y, -0.01])
                cylinder(d=ms_d + 0.5, h=lt + 0.2);
            translate([p.x, p.y, -0.01])
                cylinder(d1=6.6, d2=3.6, h=2.2);
        }
    }
}

// ===========================================================================
//  CAGE — gaiola interna parafusada que abriga o NodeMCU
// ===========================================================================
module cage() {
    // furos M3 para fixar no body (parafusos passam de fora através dos postes)
    cage_mount_inset = 4;
    cage_mounts = [
        [cage_mount_inset, cage_mount_inset],
        [cage_out_w - cage_mount_inset, cage_mount_inset],
        [cage_mount_inset, cage_out_d - cage_mount_inset],
        [cage_out_w - cage_mount_inset, cage_out_d - cage_mount_inset]
    ];

    difference() {
        union() {
            // casca: base fechada, topo aberto
            difference() {
                rounded_box(cage_out_w, cage_out_d, cage_out_h, 3);
                translate([cage_wall, cage_wall, cage_wall])
                    rounded_box_safe(
                        cage_out_w - 2*cage_wall,
                        cage_out_d - 2*cage_wall,
                        cage_out_h,
                        2
                    );
            }

            // pinos-guia internos para o PCB
            translate([cage_wall + cage_clear_xy, cage_wall + cage_clear_xy,
                       cage_wall])
            {
                pcb_guides = [
                    [-1.5, pcb_d/2],
                    [pcb_w + 1.5, pcb_d/2],
                    [pcb_w/2, -1.5],
                    [pcb_w/2, pcb_d + 1.5]
                ];
                for (g = pcb_guides)
                    translate([g.x, g.y, 0])
                        cylinder(d=4, h=5);
            }

            // bossas internas da tampa da gaiola (M2)
            for (p = cage_mounts)
                translate([p.x, p.y, cage_out_h - 6])
                    cylinder(d=5.5, h=6);
        }

        // furos M3 passantes (fixação no body)
        for (p = cage_mounts)
            translate([p.x, p.y, -0.1])
                cylinder(d=cage_screw_d, h=cage_out_h + 0.2);

        // furo oval grande no topo da PAREDE pros fios do botão passarem
        translate([cage_out_w/2 - 6, -0.1, cage_out_h - 10])
            cube([12, cage_wall + 0.2, 8]);

        // rasgo USB na lateral da gaiola (alinhado com USB do body)
        translate([-0.1, cage_out_d/2 - usb_w/2, cage_wall + 3])
            cube([cage_wall + 0.2, usb_w, usb_h]);

        // furos M2 pra tampa
        for (p = cage_mounts)
            translate([p.x, p.y, cage_out_h - 6])
                cylinder(d=cage_lid_screw_d, h=8);
    }
}

// ===========================================================================
//  CAGE_LID — tampa da gaiola
// ===========================================================================
module cage_lid() {
    clt = 2.5;
    cage_mount_inset = 4;

    difference() {
        rounded_box(cage_out_w, cage_out_d, clt, 3);
        for (p = [
            [cage_mount_inset, cage_mount_inset],
            [cage_out_w - cage_mount_inset, cage_mount_inset],
            [cage_mount_inset, cage_out_d - cage_mount_inset],
            [cage_out_w - cage_mount_inset, cage_out_d - cage_mount_inset]
        ])
            translate([p.x, p.y, -0.1])
                cylinder(d=cage_lid_screw_d + 0.4, h=clt + 0.2);
    }
}

// ===========================================================================
//  BUMPER — cantoneira TPU opcional
// ===========================================================================
module bumper() {
    bt = 4;
    bh = 22;
    ba = 32;
    intersection() {
        difference() {
            rounded_box(out_w + 2*bt, out_d + 2*bt, bh, corner_r + bt);
            translate([bt, bt, -0.1])
                rounded_box(out_w, out_d, bh + 0.2, corner_r);
        }
        translate([0, 0, -0.1])
            cube([ba + bt, ba + bt, bh + 0.2]);
    }
}

// ===========================================================================
//  RENDER — descomente APENAS UM módulo pra exportar STL (F6, F7)
// ===========================================================================

body();
// main_lid();
// cage();
// cage_lid();
// bumper();        // imprima 4 em TPU

// --- PREVIEW MONTADO (apenas visualização) --------------------------------
/*
color("silver")            body();
color("silver")            translate([0, 0, -floor_t - 0.2]) main_lid();
color("dimgray")
    translate([cage_posts[0].x - cage_out_w/2 + 4,
               cage_posts[0].y - cage_out_d/2 + 4,
               cs_post_h])
        cage();
*/
