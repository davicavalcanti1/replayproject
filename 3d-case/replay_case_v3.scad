/*
 * Replay MVP — Caixa Robusta V3 "ReFrame Edition"
 * =================================================
 * Igual à V2 (casca reforçada + gaiola interna parafusada) porém com
 * a LOGO R verdadeira gravada no topo (acima do botão) e o texto
 * "ReFrame" gravado embaixo do botão.
 *
 * REQUISITO IMPORTANTE:
 *   O arquivo "reframe_r.png" (gerado por extract_logo.py) precisa estar
 *   NO MESMO DIRETÓRIO deste .scad. O OpenSCAD lê esse PNG como heightmap
 *   pra criar a gravação 3D do R.
 *
 * Peças imprimíveis:
 *   1. body()        – corpo externo com logo R gravada + "ReFrame" embaixo
 *   2. main_lid()    – tampa inferior
 *   3. cage()        – gaiola interna parafusada
 *   4. cage_lid()    – tampa da gaiola
 *   5. bumper()      – cantoneira TPU (opcional)
 *
 * Impressão / montagem: ver cabeçalho do replay_case_v2.scad.
 * Filamento sugerido: ASA ou PETG SILVER.
 *
 * Truque pra destacar a logo depois de imprimir:
 *   Passe tinta acrílica preta (ou roxa, como no original) na gravação
 *   com pincel, e limpe o excesso da superfície plana com álcool
 *   isopropílico antes de secar. A tinta fica só no fundo da gravação.
 */

// ===========================================================================
//  PARÂMETROS
// ===========================================================================
$fn = 80;

// --- dimensões internas do corpo ---
in_w = 110;
in_d = 95;          // um pouco mais fundo que a V2 pra caber logo R + texto
in_h = 55;

// --- paredes e cantos ---
wall      = 5.0;
floor_t   = 5.0;
corner_r  = 10;

// --- nervuras internas ---
rib_enable    = true;
rib_w         = 2.5;
rib_spacing_z = 22;

// --- botão arcade 30 mm ---
btn_hole     = 28;
btn_offset_y = 8;   // botão ligeiramente ao norte do centro da tampa

// --- USB micro ---
usb_w = 13;
usb_h = 8;
usb_z = 22;

// --- parafusos externos ---
ms_d      = 3.3;
ms_boss_d = 11;
ms_boss_h = 14;

// --- gaiola / postes ---
cs_d      = 3.3;
cs_post_d = 8;
cs_post_h = 6;

// --- gaiola interna ---
pcb_w = 58;
pcb_d = 31;
pcb_h = 15;
cage_wall      = 3.0;
cage_clear_xy  = 3;
cage_clear_z   = 5;
cage_screw_d       = 3.3;
cage_lid_screw_d   = 2.2;

// --- gaxeta ---
gasket_w     = 2.4;
gasket_depth = 1.5;

// --- abas laterais ---
ear_enable = true;
ear_l      = 22;
ear_t      = 6;
ear_hole   = 5;

// --- LOGO R (gravação via surface/heightmap) ---
logo_r_file     = "reframe_r.png";
logo_r_px       = 220;     // dimensão em pixels do PNG (precisa bater)
logo_r_size     = 22;      // largura/altura em mm no STL
logo_r_depth    = 1.2;     // profundidade da gravação
logo_r_offset_y = 28;      // distância do centro do topo (pro norte)

// --- TEXTO "ReFrame" (abaixo do botão) ---
text_content    = "ReFrame";
text_font       = "Arial:style=Bold";
text_size       = 13;
text_depth      = 1.2;
text_offset_y   = -22;     // pro sul

// ===========================================================================
//  DERIVADOS
// ===========================================================================
out_w = in_w + 2*wall;
out_d = in_d + 2*wall;
out_h = in_h + 2*floor_t;

ms_boss_inset = wall + 5;
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
    cy = out_d/2 + 12,
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

module internal_ribs() {
    if (rib_enable) {
        for (x = [wall + 0.1, out_w - wall - rib_w - 0.1])
            for (z = [floor_t + 4 : rib_spacing_z : out_h - floor_t - 8])
                translate([x, wall + 2, z])
                    cube([rib_w, in_d - 4, rib_w]);
        for (y = [wall + 0.1, out_d - wall - rib_w - 0.1])
            for (z = [floor_t + 4 : rib_spacing_z : out_h - floor_t - 8])
                translate([wall + 2, y, z])
                    cube([in_w - 4, rib_w, rib_w]);
    }
}

// ===========================================================================
//  LOGO R — via surface() do PNG
// ===========================================================================
//
// O surface() do OpenSCAD lê o PNG e gera geometria onde a altura
// é proporcional à luminosidade do pixel (0 = preto / Z=0, 255 = branco / Z=255).
// A gente escala Z pra logo_r_depth e X/Y pra logo_r_size.
//
module logo_r_3d() {
    s_xy = logo_r_size / logo_r_px;
    s_z  = logo_r_depth / 255;

    // surface vem com origem em (0,0); recentralizamos
    translate([-logo_r_size/2, -logo_r_size/2, 0])
        scale([s_xy, s_xy, s_z])
            surface(file = logo_r_file, center = false, convexity = 12);
}

// ===========================================================================
//  GRAVAÇÕES NO TOPO (negativo que será subtraído)
// ===========================================================================
module top_engravings() {
    // LOGO R (acima do botão)
    translate([out_w/2, out_d/2 + logo_r_offset_y, out_h - logo_r_depth])
        logo_r_3d();

    // TEXTO "ReFrame" (abaixo do botão)
    translate([out_w/2, out_d/2 + text_offset_y, out_h - text_depth])
        linear_extrude(height = text_depth + 0.2)
            text(text_content,
                 size   = text_size,
                 font   = text_font,
                 halign = "center",
                 valign = "center");
}

// ===========================================================================
//  BODY
// ===========================================================================
module body() {
    difference() {
        union() {
            // casca
            difference() {
                rounded_box(out_w, out_d, out_h, corner_r);
                translate([wall, wall, -0.01])
                    rounded_box_safe(
                        in_w, in_d, out_h - floor_t + 0.02,
                        corner_r - wall
                    );
            }

            // buchas de parafuso da tampa inferior
            for (p = main_screw_pos)
                translate([p.x, p.y, 0])
                    cylinder(d=ms_boss_d, h=ms_boss_h);

            // postes para a gaiola
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

        // furo do botão
        translate([out_w/2, out_d/2 + btn_offset_y, out_h - floor_t - 0.1])
            cylinder(d=btn_hole, h=floor_t + 1);
        translate([out_w/2, out_d/2 + btn_offset_y, out_h - 1.0])
            cylinder(d1=btn_hole, d2=btn_hole + 2, h=1.01);

        // USB
        translate([-0.1, out_d/2 - usb_w/2, usb_z])
            cube([wall + 0.2, usb_w, usb_h]);

        // parafusos main_lid
        for (p = main_screw_pos)
            translate([p.x, p.y, -0.1])
                cylinder(d=ms_d, h=ms_boss_h + 0.2);

        // parafusos da gaiola (vindo de fora, pelo chão)
        for (p = cage_posts)
            translate([p.x, p.y, -0.1])
                cylinder(d=cs_d, h=cs_post_h + 2);

        // canal da gaxeta
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

        // ===== LOGO R + TEXTO ReFrame GRAVADOS =====
        top_engravings();
    }
}

// ===========================================================================
//  MAIN_LID
// ===========================================================================
module main_lid() {
    lt = floor_t;
    difference() {
        union() {
            rounded_box(out_w, out_d, lt, corner_r);
            translate([wall + 0.4, wall + 0.4, lt - 0.01])
                difference() {
                    rounded_box_safe(in_w - 0.8, in_d - 0.8, 2.5,
                                     max(0.3, corner_r - wall));
                    translate([1.5, 1.5, -0.1])
                        rounded_box_safe(in_w - 3.8, in_d - 3.8, 2.8,
                                         max(0.2, corner_r - wall - 1.5));
                }
        }
        for (p = main_screw_pos) {
            translate([p.x, p.y, -0.01])
                cylinder(d=ms_d + 0.5, h=lt + 0.2);
            translate([p.x, p.y, -0.01])
                cylinder(d1=6.6, d2=3.6, h=2.2);
        }
    }
}

// ===========================================================================
//  CAGE
// ===========================================================================
module cage() {
    cage_mount_inset = 4;
    cage_mounts = [
        [cage_mount_inset, cage_mount_inset],
        [cage_out_w - cage_mount_inset, cage_mount_inset],
        [cage_mount_inset, cage_out_d - cage_mount_inset],
        [cage_out_w - cage_mount_inset, cage_out_d - cage_mount_inset]
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
//  RENDER — descomente UM por vez (F6, F7 pra exportar STL)
// ===========================================================================

body();
// main_lid();
// cage();
// cage_lid();
// bumper();     // imprimir 4x em TPU flexível

// Visualização apenas do logo (pra testar a gravação):
// logo_r_3d();
