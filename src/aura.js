Hooks.on('init', () => {
    game.settings.register("ActiveAuras", "measurement", {
        name: game.i18n.format("ACTIVEAURAS.measurmentoptions_name"),
        hint: game.i18n.format("ACTIVEAURAS.measurmentoptions_hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });
    game.settings.register("ActiveAuras", "wall-block", {
        name: game.i18n.format("ACTIVEAURAS.walltoptions_name"),
        hint: game.i18n.format("ACTIVEAURAS.walltoptions_hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });
    game.settings.register("ActiveAuras", "vertical-euclidean", {
        name: game.i18n.format("ACTIVEAURAS.measurementHeight_name"),
        hint: game.i18n.format("ACTIVEAURAS.measurementHeight_hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });
});

let existingActiveEffectsApply;

Hooks.on("ready", () => {
    const MODULE_NAME = "ActiveAuras";

    /**
     * Bind a filter to the ActiveEffect.apply() prototype chain
     */
    existingActiveEffectsApply = CONFIG.ActiveEffect.entityClass.prototype.apply;
    CONFIG.ActiveEffect.entityClass.prototype.apply = ActiveAurasApply;

    /**
     * Hooks onto effect sheet to add aura configuration
     */
    Hooks.on("renderActiveEffectConfig", async (sheet, html) => {
        const flags = sheet.object.data.flags ?? {};

        const FormIsAura = game.i18n.format("ACTIVEAURAS.FORM_IsAura");
        const FormIgnoreSelf = game.i18n.format("ACTIVEAURAS.FORM_IgnoreSelf");
        const FormHidden = game.i18n.format("ACTIVEAURAS.FORM_Hidden");
        const FormTargetsName = game.i18n.format("ACTIVEAURAS.FORM_TargetsName");
        const FormTargetsEnemy = game.i18n.format("ACTIVEAURAS.FORM_TargetsEnemy");
        const FormTargetsAllies = game.i18n.format("ACTIVEAURAS.FORM_TargetsAllies");
        const FormTargetsAll = game.i18n.format("ACTIVEAURAS.FORM_TargetsAll");
        const FormRadius = game.i18n.format("ACTIVEAURAS.FORM_Radius");
        const AuraTab = game.i18n.format("ACTIVEAURAS.tabname");
        const FormCheckHeight = game.i18n.format("ACTIVEAURAS.FORM_Height");

        const tab = `<a class="item" data-tab="ActiveAuras"><i class="fas fa-broadcast-tower"></i> ${AuraTab}</a>`;

        const contents = `
        <div class="tab" data-tab="ActiveAuras">
            <div class="form-group">
                <label>${FormIsAura}?</label>
                <input name="flags.${MODULE_NAME}.isAura" type="checkbox" ${flags[MODULE_NAME]?.isAura ? 'checked' : ''}></input>
             </div>
             <div class="form-group">
                <label>${FormIgnoreSelf}?</label>
                <input name="flags.${MODULE_NAME}.ignoreSelf" type="checkbox" ${flags[MODULE_NAME]?.ignoreSelf ? 'checked' : ''}></input>
            </div>
            <div class="form-group">
                <label>${FormHidden}?</label>
                <input name="flags.${MODULE_NAME}.hidden" type="checkbox" ${flags[MODULE_NAME]?.hidden ? 'checked' : ''}></input>
            </div>
            <div class="form-group">
                <label>${FormCheckHeight}</label>
                <input name="flags.${MODULE_NAME}.height" type="checkbox" ${flags[MODULE_NAME]?.height ? 'checked' : ''}></input>
            </div>
            <div class="form-group">
                <label>${FormTargetsName}:</label>
                <select name="flags.${MODULE_NAME}.aura" data-dtype="String" value=${flags[MODULE_NAME]?.aura}>
                    <option value="None" ${flags[MODULE_NAME]?.aura === 'None' ? 'selected' : ''}></option>
                    <option value="Enemy"${flags[MODULE_NAME]?.aura === 'Enemy' ? 'selected' : ''}>${FormTargetsEnemy}</option>
                    <option value="Allies"${flags[MODULE_NAME]?.aura === 'Allies' ? 'selected' : ''}>${FormTargetsAllies}</option>
                    <option value="All"${flags[MODULE_NAME]?.aura === 'All' ? 'selected' : ''}>${FormTargetsAll}</option>
                </select>
            </div>
            <div class="form-group">
                <label>${FormRadius}</label>
                <input id="radius" name="flags.${MODULE_NAME}.radius" type="number" min="0" value="${flags[MODULE_NAME]?.radius}"></input>
            </div> 
        </div>`;

        html.find(".tabs .item").last().after(tab);
        html.find(".tab").last().after(contents);
    });

    let AuraMap = new Map()

    /**
     * Re-run aura detection on token creation
     */
    Hooks.on("createToken", (_scene, token) => {
        newToken = canvas.tokens.get(token._id)
        setTimeout(() => {
            CollateAuras(canvas, true, false)
        }, 20)
    });

    /**
     * @todo
     * Filter for aura effects on deleted token and remove from canvas tokens
     */
    Hooks.on("preDeleteToken", async (_scene, _token) => {
        setTimeout(() => {
            CollateAuras(canvas, false, true)
        }, 20)

    });

    Hooks.on("preUpdateToken", (_scene, token, update, _flags, _id) => {
        let removed = token.actorData?.effects?.filter(x => !update.actorData?.effects?.includes(x));
        let added = update.actorData?.effects?.filter(x => !token.actorData?.effect?.includes(x))
        if (added?.length > 0) {
            for (let effect of added) {
                if (effect.flags?.ActiveAuras?.isAura) {
                    setTimeout(() => {
                        CollateAuras(canvas, true, false)
                    }, 50)
                    return;
                }
            }
        }
        if (removed?.length > 0) {
            for (let effect of removed) {
                if (effect.flags?.ActiveAuras?.isAura) {
                    setTimeout(() => {
                        CollateAuras(canvas, true, true)
                    }, 50)
                    return;
                }
            }
        }

    })

    /**
     * On token movement run MainAura
     */
    Hooks.on("updateToken", (_scene, token, update, _flags, _id) => {
        if (("y" in update || "x" in update || "elevation" in update))
            MainAura(token)
        let auraToken = false
        if (token.actorData?.effects?.length > 0) {
            for (let effect of token.actorData?.effects) {
                if (effect.flags?.ActiveAuras?.isAura) auraToken = true; break;
            }
        }
        if ("hidden" in update && auraToken) {
            setTimeout(() => {
                CollateAuras(canvas, true, true)
            }, 20)
        }
    });


    /**
     * @todo
     */
    Hooks.on("updateActiveEffect", (_actor, effect, _update) => {
        if (effect.flags?.ActiveAuras?.isAura) {
            setTimeout(() => {
                CollateAuras(canvas, true, false)
            }, 20)
        }
    })

    /**
     * On removal of active effect from linked actor, if aura remove from canvas.tokens
     */
    Hooks.on("deleteActiveEffect", (_actor, effect) => {
        let applyStatus = effect.flags?.ActiveAuras?.applied;
        if (!applyStatus) {
            setTimeout(() => {
                CollateAuras(canvas, false, true)
            }, 20)
        }
    });

    /**
     * On creation of active effect on linked actor, run MainAura
     */
    Hooks.on("createActiveEffect", (_actor, effect) => {
        if (!effect.flags?.ActiveAuras?.applied && effect.flags?.ActiveAuras?.isAura) {
            setTimeout(() => {
                CollateAuras(canvas, true, false)
            }, 20)
        };
    });

    Hooks.on("canvasReady", (canvas) => {
        setTimeout(() => {
            CollateAuras(canvas, true, false)
        }, 20)
    })

    function GetAllFlags(entity, scope) {
        {
            const scopes = SetupConfiguration.getPackageScopes();
            if (!scopes.includes(scope)) throw new Error(`Invalid scope`);
            return getProperty(entity.data.flags, scope);
        }
    }

    function IsAuraToken(token, canvas) {
        let MapKey = canvas.scene._id;
        MapObject = AuraMap.get(MapKey);
        for (let effect of MapObject.effects) {
            if (effect.tokenId === token._id) return true;

        }
    }

    function CollateAuras(canvas, checkAuras, removeAuras) {
        let gm = game.user === game.users.find((u) => u.isGM && u.active)
        if (!gm) return;
        let MapKey = canvas.scene._id;
        MapObject = AuraMap.get(MapKey);
        let effectArray = [];
        for (let testToken of canvas.tokens.placeables) {

            if (testToken.actor === null || testToken.actor === undefined) continue;
            if (game.modules.get("multilevel-tokens")?.active) {
                if (GetAllFlags(testToken, 'multilevel-tokens')) continue;
            }
            for (let testEffect of testToken?.actor?.effects.entries) {
                if (testEffect.getFlag('ActiveAuras', 'isAura')) {
                    if(testEffect.data.disabled) continue;
                    if (testEffect.getFlag('ActiveAuras', 'hidden') && testToken.data.hidden) continue;
                    let newEffect = { data: duplicate(testEffect.data), parentActorLink: testEffect.parent.data.token.actorLink, parentActorId: testEffect.parent._id, tokenId: testToken.id }
                    for (let change of newEffect.data.changes) {
                        if (typeof change.value === "string" && change.key !== "macro.execute") {
                            if (change.value.includes("@")) {
                                let dataPath = change.value.substring(2)
                                let newValue = getProperty(testToken.actor.getRollData(), dataPath)
                                const changeIndex = newEffect.data.changes.findIndex(i => i.value === change.value && i.key === change.key)
                                newEffect.data.changes[changeIndex].value = `+ ${newValue}`
                            }
                        }
                        if (change.key === "macro.execute") newEffect.data.flags.ActiveAuras.isMacro = true
                    }
                    newEffect.data.disabled = false
                    let macro = newEffect.data.flags.ActiveAuras.isMacro !== undefined ? false : newEffect.data.flags.ActiveAuras.isMacro

                    newEffect.data.flags.ActiveAuras.isAura = false;
                    newEffect.data.flags.ActiveAuras.applied = true;
                    newEffect.data.flags.ActiveAuras.isMacro = macro;

                    effectArray.push(newEffect)
                }
            }
        }
        if (MapObject) {
            MapObject.effects = effectArray
        }
        else {
            AuraMap.set(MapKey, { effects: effectArray })
        }
        if (checkAuras) {
            setTimeout(() => {
                MainAura()
            }, 20)
        }
        if (removeAuras) {
            setTimeout(() => {
                RemoveAppliedAuras(canvas)
            }, 20)
        }
    }

    async function RemoveAppliedAuras() {
        let EffectsArray = [];
        let MapKey = canvas.scene._id
        MapObject = AuraMap.get(MapKey)
        MapObject.effects.forEach(i => EffectsArray.push(i.data.origin))

        for (let removeToken of canvas.tokens.placeables) {
            if (removeToken?.actor?.effects) {
                for (let testEffect of removeToken.actor.effects) {
                    if (!EffectsArray.includes(testEffect.data.origin) && testEffect.data?.flags?.ActiveAuras?.applied) await testEffect.delete()
                }
            }
        }
    }

    /**
     * 
     * @param {Token} movedToken - optional value for further extension, currently unused
     * Locate all auras on the canvas, create map of tokens to update, update tokens 
     */
    function MainAura(movedToken) {
        let gm = game.user === game.users.find((u) => u.isGM && u.active)
        if (!gm) return;

        let map = new Map();
        let updateTokens = canvas.tokens.placeables
                
        if (movedToken !== undefined) {
            if (!IsAuraToken(movedToken, canvas)) {
                updateTokens = [];
                updateTokens.push(canvas.tokens.get(movedToken._id))
            }
        }
        UpdateAllTokens(map, updateTokens)

        for (let mapEffect of map) {
            let MapKey = mapEffect[0]
            map.set(MapKey, { add: mapEffect[1].add, token: mapEffect[1].token, effect: mapEffect[1].effect.data })
        }

        for (let update of map) {
            if (update[1].add) {
                CreateActiveEffect(update[1].token, update[1].effect)
            }
            else {
                RemoveActiveEffects(update[1].token, update[1].effect.label)
            }
        }
        sequencialUpdate = false
    }




    /**
     * Loop over canvas tokens for individual tests
     * @param {Map} map - empty map to populate 
     * @param {Array} auraEffectArray - array of auras to test against
     * @param {Token} tokens - array of tokens to test against
     */
    function UpdateAllTokens(map, tokens) {
        for (let canvasToken of tokens) {
            UpdateToken(map, canvasToken)
        }
    }


    /**
     * Test individual token against aura array
     * @param {Map} map - empty map to populate 
     * @param {Array} auraEffectArray - array of auras to test against 
     * @param {Token} canvasToken - single token to test
     */
    function UpdateToken(map, canvasToken) {
        if (game.modules.get("multilevel-tokens")) {
            if (GetAllFlags(canvasToken, 'multilevel-tokens')) return;
        }
        let MapKey = canvasToken.scene._id;
        MapObject = AuraMap.get(MapKey)
        for (let auraEffect of MapObject.effects) {

            let auraTargets = auraEffect.data.flags?.ActiveAuras?.aura
            let MapKey = auraEffect.data.label + "-" + canvasToken.id;
            MapObject = map.get(MapKey);
            let auraToken;
            let auraRadius = auraEffect.data.flags?.ActiveAuras?.radius;
            let auraHeight = auraEffect.data.flags?.ActiveAuras?.height

            //{data: testEffect.data, parentActorLink :testEffect.parent.data.token.actorLink, parentActorId : testEffect.parent._id, tokenId: testToken.id}
            if (auraEffect.parentActorLink) {
                let auraTokenArray = game.actors.get(auraEffect.parentActorId).getActiveTokens()
                if (auraTokenArray.length > 1) {
                    auraToken = auraTokenArray.reduce(FindClosestToken, auraTokenArray[0])
                    function FindClosestToken(tokenA, tokenB) {
                        return RayDistance(tokenA, canvasToken) < RayDistance(tokenB, canvasToken) ? tokenA : tokenB
                    }
                }
                else auraToken = auraTokenArray[0]
            }
            else if (auraEffect.tokenId) {
                auraToken = canvas.tokens.get(auraEffect.tokenId)
            }
            if (auraToken.id === canvasToken.id) continue;
            if (auraTargets === "Allies" && (auraToken.data.disposition !== canvasToken.data.disposition)) continue;
            if (auraTargets === "Enemy" && (auraToken.data.disposition === canvasToken.data.disposition)) continue;

            let distance = RayDistance(canvasToken, auraToken, auraHeight)
            if ((distance !== false) && (distance <= auraRadius)) {
                if (MapObject) {
                    MapObject.add = true
                }
                else {
                    map.set(MapKey, { add: true, token: canvasToken, effect: auraEffect })
                }
            }
            else if (!MapObject?.add && canvasToken?.actor?.effects.entries.some(e => e.data.label === auraEffect.data.label)) {
                if (MapObject) {
                    MapObject.add = false
                }
                else {
                    map.set(MapKey, { add: false, token: canvasToken, effect: auraEffect })
                }
            }
        }
    }

    /**
     * 
     * @param {Token} token1 - test token
     * @param {Token} token2 - aura token
     */
    function RayDistance(token1, token2, auraHeight) {
        const ray = new Ray(token1.center, token2.center)
        const segments = [{ ray }]
        let distance;
        if (game.settings.get('ActiveAuras', 'measurement') === false) {
            distance = (ray.distance / canvas.grid.grid.options.dimensions.size) * canvas.grid.grid.options.dimensions.distance
        }
        else if (game.settings.get('ActiveAuras', 'measurement') === true) {
            distance = canvas.grid.measureDistances(segments, { gridSpaces: true })[0]
        }
        let collision = canvas.walls.checkCollision(ray)
        if (collision && game.settings.get("ActiveAuras", "wall-block") === true) return false
        if (auraHeight === true) {
            if (game.settings.get("ActiveAuras", "vertical-euclidean") === true) {
                let heightChange = Math.abs(token1.data.elevation - token2.data.elevation)
                distance = distance > heightChange ? distance : heightChange
            }
            if (game.settings.get("ActiveAuras", "vertical-euclidean") === false) {
                let a = distance;
                let b = (token1.data.elevation - token2.data.elevation)
                let c = (a * a) + (b * b)
                distance = Math.sqrt(c)
            }
        }
        return distance
    }

    /**
  * 
  * @param {Token} token - token to apply effect too
  * @param {ActiveEffect} effectData - effect data to generate effect
  */
    async function CreateActiveEffect(token, effectData) {
        if (token.actor.effects.entries.find(e => e.data.label === effectData.label)) return;
        if (effectData.flags.ActiveAuras?.isMacro) {
            for (let change of effectData.changes) {
                let newValue = change.value;
                if (change.key === "macro.execute") {
                    if (typeof newValue === "string") {
                        newValue = [newValue]
                    }
                    newValue = newValue.map(val => {
                        if (typeof val === "string" && val.includes("@token")) {
                            let re = /([\s]*@token)/gms
                            return val.replaceAll(re, ` ${token.data._id}`)
                        }
                        return val;
                    });
                    if (typeof change.value === "string")
                        change.value = newValue[0];
                    else
                        change.value = newValue;
                }
            }
        }
        await token.actor.createEmbeddedEntity("ActiveEffect", effectData);
        console.log(game.i18n.format("ACTIVEAURAS.ApplyLog", { effectDataLabel: effectData.label, tokenName: token.name }))
    }

    /**
     * 
     * @param {Token} token - token instance to remove effect from
     * @param {String} effectLabel - label of effect to remove
     */
    function RemoveActiveEffects(token, effectLabel) {
        for (let tokenEffects of token.actor.effects) {
            if (tokenEffects.data.label === effectLabel && tokenEffects.data.flags?.ActiveAuras.applied === true) {
                tokenEffects.delete()
                console.log(game.i18n.format("ACTIVEAURAS.RemoveLog", { effectDataLabel: effectLabel, tokenName: token.name }))

            }
        }
    }

    /**
     * 
     * @param {Actor} actor 
     * @param {ActiveEffect} change 
     */
    function ActiveAurasApply(actor, change) {
        if (actor._id == change.effect.data.origin?.split('.')[1] && change.effect.data.flags?.ActiveAuras?.ignoreSelf) {
            console.log(game.i18n.format("ACTIVEAURAS.IgnoreSelfLog", { effectDataLabel: change.effect.data.label, changeKey: change.key, actorName: actor.name }));
            return null;
        }
        return existingActiveEffectsApply.bind(this)(actor, change);
    }

    CollateAuras(canvas, true, false)

})