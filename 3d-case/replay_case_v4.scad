/*
 * Replay MVP — Caixa Robusta V4 "ReFrame Edition" (SQUARE, BUTTON 22mm)
 * ===============================================================================
 * Formato quadrado (mesma largura e profundidade).
 * Botão 22 mm arcade (furo 20 mm) centralizado na tampa superior.
 * Logo R (icon site) gravada em relevo no topo, acima do botão.
 *
 * Novos reforços em relação à V3:
 *   - Paredes passaram de 5 mm → 6 mm
 *   - Raio dos cantos externos: 10 → 12 mm (distribui melhor o impacto)
 *   - Parafusos M4 no fechamento principal (mais rígidos que M3)
 *   - 4 pilares de canto internos (gussets triangulares) — absorvem queda
 *   - Dupla linha de nervuras em "X" nas paredes (antes era só 1 em cada)
 *   - Nervuras EXTERNAS nas arestas verticais (faz a caixa parecer armada)
 *   - Poço rebaixado (3 mm) ao redor do botão — se cair de face, o solo bate
 *     nas bordas, não no plástico do botão
 *   - Canal de gaxeta mais fundo (1.8 mm) pra O-ring 2.5 mm
 *   - Maior folga interna pra passar um anel anti-choque de borracha na gaiola
 *
 * Peças imprimíveis:
 *   1. body()        – corpo externo
 *   2. main_lid()    – tampa inferior
 *   3. cage()        – gaiola interna parafusada
 *   4. cage_lid()    – tampa da gaiola
 *   5. bumper()      – cantoneira TPU externa (opcional, imprimir 4×)
 *
 * IMPORTANTE: "reframe_r.png" deve estar no MESMO DIRETÓRIO deste .scad.
 *
 * Filamento: ASA Silver (melhor) ou PETG Silver. Nunca PLA pro sol direto.
 */

// ===========================================================================
//  PARÂMETROS
// ===========================================================================
$fn = 80;

// --- BOTÃO ARCADE 22 mm ---
btn_face   = 22;         // diâmetro da face (só pra referência)
btn_hole   = 20;         // diâmetro do furo de montagem (padrão 22 mm: 20)
btn_margin = 6;          // folga MÍNIMA entre o botão e a parede interna
                         //   (>= 3 mm como você pediu; 6 dá sobra pra nervuras)

// --- GEOMETRIA DO CORPO (forçado quadrado) ---
// side interno = botão + 2*margem + espaço pra gaiola do PCB
// o PCB NodeMCU tem 58×31 mm, então o interior QUADRADO precisa ≥ 58+2*clearance.
inner_side = max(btn_hole + 2*btn_margin + 22, 66);   // 66 mm padrão interno
in_w = inner_side;
in_d = inner_side;       // QUADRADO: w == d
in_h = 58;               // altura interna (cabe PCB com pinos + espaço cabeado)

// --- paredes e cantos (mais robusto) ---
wall      = 6.0;
floor_t   = 6.0;
corner_r  = 12;

// --- nervuras internas duplas (X + Y) ---
rib_enable    = true;
rib_w         = 2.5;
rib_spacing_z = 16;      // duas fileiras dentro da altura da caixa

// --- nervuras EXTERNAS verticais (reforçam as arestas) ---
ext_rib_enable = true;
ext_rib_w      = 3;
ext_rib_h_inset = 4;     // recuo do topo e da base

// --- gussets (cantos internos triangulares) ---
gusset_enable = true;
gusset_size   = 10;      // tamanho do cateto
gusset_h      = 22;      // altura do gusset

// --- USB micro ---
usb_w = 13;
usb_h = 8;
usb_z = 22;

// --- parafusos externos (M4 agora) ---
ms_d       = 4.3;
ms_boss_d  = 12;
ms_boss_h  = 16;

// --- poço rebaixado ao redor do botão (proteção de queda frontal) ---
recess_enable = true;
recess_depth  = 3.0;     // abaixo da superfície do topo
recess_margin = 3.0;     // quanto o poço se estende além do furo

// --- gaiola interna / postes ---
pcb_w = 58;
pcb_d = 31;
pcb_h = 15;
cage_wall      = 3.0;
cage_clear_xy  = 3;
cage_clear_z   = 5;
cage_screw_d       = 3.3;   // M3 para fixar no body
cage_lid_screw_d   = 2.2;   // M2 para a tampa da gaiola
cs_d      = 3.3;
cs_post_d = 8;
cs_post_h = 7;

// --- gaxeta ---
gasket_w     = 2.8;
gasket_depth = 1.8;

// --- abas de fixação em parede ---
ear_enable = true;
ear_l      = 22;
ear_t      = 6;
ear_hole   = 5;

// --- LOGO R (via surface do PNG heightmap) ---
logo_r_file     = "reframe_r.png";
logo_r_px       = 220;
logo_r_size     = 22;        // lado do quadrado da logo em mm
logo_r_depth    = 1.5;       // mais profunda pra destacar com tinta
logo_r_offset_y = 18;        // distância do centro pro NORTE

// ===========================================================================
//  DERIVADOS
// ===========================================================================
out_w = in_w + 2*wall;
out_d = in_d + 2*wall;
out_h = in_h + 2*floor_t;

ms_boss_inset = wall + 6;
main_screw_pos = [
    [ms_boss_inset,         ms_boss_inset        ],
    [out_w - ms_boss_inset, ms_boss_inset        ],
    [ms_boss_inset,         out_d - ms_boss_inset],
    [out_w - ms_boss_inset, out_d - ms_boss_inset]
];

cage_out_w = pcb_w + 2*(cage_wall + cage_clear_xy);
cage_out_d = pcb_d + 2*(cage_wall + cage_clear_xy);
cage_out_h = pcb_h + cage_wall + cage_clear_z;

cage_posts = let (
    cx = out_w/2,
    cy = out_d/2,
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

// nervuras internas duplas horizontais
module internal_ribs() {
    if (rib_enable) {
        for (x = [wall + 0.1, out_w - wall - rib_w - 0.1])
            for (z = [floor_t + 6 : rib_spacing_z : out_h - floor_t - 8])
                translate([x, wall + 2, z])
                    cube([rib_w, in_d - 4, rib_w]);
        for (y = [wall + 0.1, out_d - wall - rib_w - 0.1])
            for (z = [floor_t + 6 : rib_spacing_z : out_h - floor_t - 8])
                translate([wall + 2, y, z])
                    cube([in_w - 4, rib_w, rib_w]);
    }
}

// nervuras externas verticais nas 4 arestas
module external_ribs() {
    if (ext_rib_enable) {
        positions = [
            [corner_r,              0               ],
            [out_w - corner_r,      0               ],
            [corner_r,              out_d           ],
            [out_w - corner_r,      out_d           ],
            [0,                     corner_r        ],
            [0,                     out_d - corner_r],
            [out_w,                 corner_r        ],
            [out_w,                 out_d - corner_r]
        ];
        for (p = positions)
            translate([p.x - ext_rib_w/2, p.y - ext_rib_w/2, ext_rib_h_inset])
                cube([ext_rib_w, ext_rib_w, out_h - 2*ext_rib_h_inset]);
    }
}

// gussets internos (cantos reforçados)
module corner_gussets() {
    if (gusset_enable) {
        corners = [
            [wall,             wall             , 0,   0],
            [out_w - wall,     wall             , 1,   0],
            [wall,             out_d - wall     , 0,   1],
            [out_w - wall,     out_d - wall     , 1,   1]
        ];
        for (c = corners) {
            sx = (c[2] == 0) ? 1 : -1;
            sy = (c[3] == 0) ? 1 : -1;
            translate([c[0], c[1], floor_t])
                linear_extrude(height = gusset_h)
                    polygon([
                        [0, 0],
                        [sx * gusset_size, 0],
                        [0, sy * gusset_size]
                    ]);
        }
    }
}

// ===========================================================================
//  LOGO R — via surface()
// ===========================================================================
module logo_r_3d() {
    s_xy = logo_r_size / logo_r_px;
    s_z  = logo_r_depth / 255;
    translate([-logo_r_size/2, -logo_r_size/2, 0])
        scale([s_xy, s_xy, s_z])
            surface(file = logo_r_file, center = false, convexity = 12);
}

// gravação no topo (negativo pro difference)
module top_engravings() {
    translate([out_w/2, out_d/2 + logo_r_offset_y, out_h - logo_r_depth])
        logo_r_3d();
}

// poço rebaixado (também negativo) ao redor do botão
module button_recess() {
    if (recess_enable) {
        translate([out_w/2, out_d/2, out_h - recess_depth])
            cylinder(d = btn_hole + 2*recess_margin, h = recess_depth + 0.1);
    }
}

// ===========================================================================
//  BODY
// ===========================================================================
module body() {
    difference() {
        union() {
            // casca externa
            difference() {
                rounded_box(out_w, out_d, out_h, corner_r);
                translate([wall, wall, -0.01])
                    rounded_box_safe(in_w, in_d, out_h - floor_t + 0.02,
                                     corner_r - wall);
            }

            // buchas de parafuso (tampa inferior)
            for (p = main_screw_pos)
                translate([p.x, p.y, 0])
                    cylinder(d=ms_boss_d, h=ms_boss_h);

            // postes internos para a gaiola
            for (p = cage_posts)
                translate([p.x, p.y, 0])
                    cylinder(d=cs_post_d + 2, h=cs_post_h);

            // nervuras
            internal_ribs();
            external_ribs();
            corner_gussets();

            // abas laterais
            if (ear_enable) {
                translate([0,     out_d/2, 0]) rotate([0,0,180]) ear();
                translate([out_w, out_d/2, 0]) ear();
            }
        }

        // POÇO REBAIXADO ao redor do botão
        button_recess();

        // furo do botão arcade 22 mm
        translate([out_w/2, out_d/2, out_h - floor_t - 0.1])
            cylinder(d=btn_hole, h=floor_t + 1);

        // chanfro leve no furo do botão
        translate([out_w/2, out_d/2, out_h - recess_depth - 0.5])
            cylinder(d1=btn_hole, d2=btn_hole + 1.5, h=0.55);

        // USB lateral (−X)
        translate([-0.1, out_d/2 - usb_w/2, usb_z])
            cube([wall + 0.2, usb_w, usb_h]);

        // parafusos M4 (tampa inferior)
        for (p = main_screw_pos)
            translate([p.x, p.y, -0.1])
                cylinder(d=ms_d, h=ms_boss_h + 0.2);

        // parafusos M3 da gaiola (passam de fora, pelo fundo)
        for (p = cage_posts)
            translate([p.x, p.y, -0.1])
                cylinder(d=cs_d, h=cs_post_h + 2);

        // canal da gaxeta
        translate([wall + gasket_w, wall + gasket_w, -0.01])
            difference() {
                rounded_box_safe(in_w - 2*gasket_w, in_d - 2*gasket_w,
                                 gasket_depth, corner_r - wall - gasket_w);
                translate([gasket_w, gasket_w, -0.02])
                    rounded_box_safe(in_w - 4*gasket_w, in_d - 4*gasket_w,
                                     gasket_depth + 0.1,
                                     corner_r - wall - 2*gasket_w);
            }

        // ===== LOGO R GRAVADA =====
        top_engravings();
    }
}

// ===========================================================================
//  MAIN_LID (tampa inferior)
// ===========================================================================
module main_lid() {
    lt = floor_t;
    difference() {
        union() {
            rounded_box(out_w, out_d, lt, corner_r);
            // lip de alinhamento
            translate([wall + 0.4, wall + 0.4, lt - 0.01])
                difference() {
                    rounded_box_safe(in_w - 0.8, in_d - 0.8, 3,
                                     max(0.3, corner_r - wall));
                    translate([1.5, 1.5, -0.1])
                        rounded_box_safe(in_w - 3.8, in_d - 3.8, 3.3,
                                         max(0.2, corner_r - wall - 1.5));
                }
        }
        // parafusos M4 com countersink
        for (p = main_screw_pos) {
            translate([p.x, p.y, -0.01])
                cylinder(d=ms_d + 0.5, h=lt + 0.2);
            translate([p.x, p.y, -0.01])
                cylinder(d1=8.2, d2=4.6, h=2.6);
        }
    }
}

// ===========================================================================
//  CAGE
// ===========================================================================
module cage() {
    cage_mount_inset = 4;
    cage_mounts = [
        [cage_mount_inset,                 cage_mount_inset                ],
        [cage_out_w - cage_mount_inset,    cage_mount_inset                ],
        [cage_mount_inset,                 cage_out_d - cage_mount_inset   ],
        [cage_out_w - cage_mount_inset,    cage_out_d - cage_mount_inset   ]
    ];

    difference() {
        union() {
            difference() {
                rounded_box(cage_out_w, cage_out_d, cage_out_h, 3);
                translate([cage_wall, cage_wall, cage_wall])
                    rounded_box_safe(cage_out_w - 2*cage_wall,
                                     cage_out_d - 2*cage_wall,
                                     cage_out_h, 2);
            }
            translate([cage_wall + cage_clear_xy,
                       cage_wall + cage_clear_xy, cage_wall])
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
            for (p = cage_mounts)
                translate([p.x, p.y, cage_out_h - 6])
                    cylinder(d=5.5, h=6);
        }
        for (p = cage_mounts)
            translate([p.x, p.y, -0.1])
                cylinder(d=cage_screw_d, h=cage_out_h + 0.2);
        translate([cage_out_w/2 - 6, -0.1, cage_out_h - 10])
            cube([12, cage_wall + 0.2, 8]);
        translate([-0.1, cage_out_d/2 - usb_w/2, cage_wall + 3])
            cube([cage_wall + 0.2, usb_w, usb_h]);
        for (p = cage_mounts)
            translate([p.x, p.y, cage_out_h - 6])
                cylinder(d=cage_lid_screw_d, h=8);
    }
}

// ===========================================================================
//  CAGE_LID
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
//  BUMPER TPU (opcional)
// ===========================================================================
module bumper() {
    bt = 4;
    bh = 26;
    ba = 34;
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
//  RENDER — descomente UM por vez (F6, F7 para STL)
// ===========================================================================

body();
// main_lid();
// cage();
// cage_lid();
// bumper();     // 4× em TPU flexível

// debug: só o logo pra conferir posição
// translate([out_w/2, out_d/2 + logo_r_offset_y, 0]) logo_r_3d();
